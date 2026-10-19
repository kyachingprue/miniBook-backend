import { prisma } from '../../config/prisma'
import { ApiError } from '../../utils/ApiError'
import { cursorArgs, toPage } from '../../utils/response'
import { actorSelect } from '../notifications/notification.service'
import { emitToUser } from '../../lib/socket'
import { canMessage } from '../users/user.service'

async function assertMember(conversationId: string, userId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId
      }
    },
    select: { userId: true }
  })

  if (!member) {
    throw ApiError.notFound('Conversation not found')
  }
}

export const messageService = {
  async conversations(userId: string) {
    const rows = await prisma.conversation.findMany({
      where: {
        members: { some: { userId } }
      },
      orderBy: { updatedAt: 'desc' },
      distinct: ['id'],
      include: {
        members: {
          where: { userId: { not: userId } },
          include: {
            user: {
              select: {
                ...actorSelect,
                lastSeenAt: true
              }
            }
          },
          take: 1
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    const myMemberships = await prisma.conversationMember.findMany({
      where: {
        userId,
        conversationId: {
          in: rows.map(row => row.id)
        }
      },
      select: {
        conversationId: true,
        lastReadAt: true
      }
    })

    const readMap = new Map(
      myMemberships.map(membership => [
        membership.conversationId,
        membership.lastReadAt
      ])
    )

    const seenUsers = new Set<string>()
    const result = []

    for (const conversation of rows) {
      const other = conversation.members[0]?.user

      if (!other) continue
      if (seenUsers.has(other.id)) continue

      seenUsers.add(other.id)

      const lastReadAt = readMap.get(conversation.id) ?? null

      const lastMessage = conversation.messages[0] ?? null

      let unread = 0

      if (
        lastMessage &&
        lastMessage.senderId !== userId &&
        (!lastReadAt || lastMessage.createdAt > lastReadAt)
      ) {
        unread = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: userId },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {})
          }
        })
      }

      result.push({
        id: conversation.id,
        user: other,
        lastMessage,
        updatedAt: conversation.updatedAt,
        otherLastReadAt: conversation.members[0]?.lastReadAt ?? null,
        unreadCount: unread
      })
    }

    return result
  },

  /** Total unread messages for the navbar badge. */
  async unreadCount(userId: string) {
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: {
        conversationId: true,
        lastReadAt: true
      }
    })

    if (memberships.length === 0) return 0

    let total = 0

    for (const membership of memberships) {
      const count = await prisma.message.count({
        where: {
          conversationId: membership.conversationId,
          senderId: { not: userId },
          ...(membership.lastReadAt
            ? {
                createdAt: {
                  gt: membership.lastReadAt
                }
              }
            : {})
        }
      })

      total += count
    }

    return total
  },

  /** Start a new conversation with an authorized user. */
  async start(userId: string, username: string) {
    const target = await prisma.user.findUnique({
      where: {
        username: username.toLowerCase()
      },
      select: { id: true }
    })

    if (!target) {
      throw ApiError.notFound('User not found')
    }

    if (target.id === userId) {
      throw ApiError.badRequest('You cannot message yourself')
    }

    const allowed = await canMessage(userId, target.id)

    if (!allowed) {
      throw ApiError.forbidden(
        'You can only start a conversation with users who follow you or whom you follow (accepted)'
      )
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          {
            members: {
              some: { userId }
            }
          },
          {
            members: {
              some: { userId: target.id }
            }
          }
        ]
      },
      select: { id: true }
    })

    if (existing) return existing

    return prisma.conversation.create({
      data: {
        members: {
          create: [{ userId }, { userId: target.id }]
        }
      },
      select: { id: true }
    })
  },

  /** Get paginated messages from an existing conversation. */
  async messages(
    conversationId: string,
    userId: string,
    cursor: string | undefined,
    limit: number
  ) {
    await assertMember(conversationId, userId)

    const rows = await prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(cursor, limit)
    })

    return toPage(rows, limit)
  },

  /** Send a message inside an existing conversation. */
  async send(conversationId: string, userId: string, text: string) {
    await assertMember(conversationId, userId)

    const cleanText = text.trim()

    if (!cleanText) {
      throw ApiError.badRequest('Message cannot be empty')
    }

    const other = await prisma.conversationMember.findFirst({
      where: {
        conversationId,
        userId: { not: userId }
      },
      select: { userId: true }
    })

    if (!other) {
      throw ApiError.notFound('Conversation participant not found')
    }

    // Existing conversation members can continue chatting
    // even if their follow relationship changes.
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          text: cleanText
        }
      }),

      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      })
    ])

    // Realtime push → only the Messages icon / page reacts (no bell notification)
    emitToUser(other.userId, 'message:new', {
      conversationId,
      message
    })

    return message
  },

  /** Mark a conversation as read for the current user. */
  async markRead(conversationId: string, userId: string) {
    await assertMember(conversationId, userId)

    await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId
        }
      },
      data: {
        lastReadAt: new Date()
      }
    })

    const other = await prisma.conversationMember.findFirst({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true }
    })
    if (other) emitToUser(other.userId, 'message:read', { conversationId })
  }
}
