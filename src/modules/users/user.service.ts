import type { Prisma, PrivacyLevel } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { ApiError } from '../../utils/ApiError'
import {
  clearFollowNotifications,
  notify
} from '../notifications/notification.service'
import { emitToUser } from '../../lib/socket'
import { privateUser } from '../auth/auth.service'

const publicSelect = {
  id: true,
  name: true,
  username: true,
  avatar: true,
  bio: true,
  lastSeenAt: true
} as const

/** Profile card shape used by the frontend. `viewerId` adds relationship flags. */
const profileInclude = (viewerId?: string) =>
  ({
    _count: {
      select: {
        followers: { where: { status: 'ACCEPTED' } },
        following: { where: { status: 'ACCEPTED' } },
        posts: true
      }
    },
    followers: viewerId
      ? {
          where: { followerId: viewerId },
          select: { followerId: true, status: true },
          take: 1
        }
      : {
          where: { followerId: '' },
          select: { followerId: true, status: true },
          take: 0
        },
    following: viewerId
      ? {
          where: { followingId: viewerId },
          select: { followingId: true, status: true },
          take: 1
        }
      : {
          where: { followingId: '' },
          select: { followingId: true, status: true },
          take: 0
        }
  }) satisfies Prisma.UserInclude

type ProfileRow = Prisma.UserGetPayload<{
  include: ReturnType<typeof profileInclude>
}>

const toProfile = (u: ProfileRow, viewerId?: string) => {
  const outgoing = u.followers[0] // viewer follows this user
  const incoming = u.following[0] // this user follows viewer
  const status = outgoing?.status ?? null
  const isMe = viewerId === u.id

  // Privacy gate: private accounts hide details from non-followers
  const canViewFull =
    isMe ||
    u.privacy === 'PUBLIC' ||
    (u.privacy === 'PRIVATE' && status === 'ACCEPTED') ||
    (u.privacy === 'FRIENDS' && status === 'ACCEPTED')

  return {
    id: u.id,
    name: u.name,
    username: u.username,
    avatar: u.avatar,
    cover: canViewFull ? u.cover : null,
    bio: canViewFull ? u.bio : null,
    location: canViewFull ? u.location : null,
    website: canViewFull ? u.website : null,
    passion: canViewFull ? u.passion : null,
    relationshipStatus: canViewFull ? u.relationshipStatus : null,
    privacy: u.privacy,
    lastSeenAt: canViewFull ? u.lastSeenAt : null,
    createdAt: u.createdAt,
    followersCount: u._count.followers,
    followingCount: u._count.following,
    postsCount: canViewFull ? u._count.posts : 0,
    isFollowing: status === 'ACCEPTED',
    isRequested: status === 'PENDING',
    followStatus: status,
    isFollower: incoming?.status === 'ACCEPTED',
    hasIncomingRequest: incoming?.status === 'PENDING',
    canMessage:
      isMe || status === 'ACCEPTED' || incoming?.status === 'ACCEPTED',
    canViewContent: canViewFull
  }
}

async function findOrFail(username: string) {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, privacy: true }
  })
  if (!user) throw ApiError.notFound('User not found')
  return user
}

/** True if viewer is an accepted follower of target (or is the target). */
export async function isAcceptedFollower(
  viewerId: string | undefined,
  targetId: string
) {
  if (!viewerId) return false
  if (viewerId === targetId) return true
  const row = await prisma.follow.findUnique({
    where: {
      followerId_followingId: { followerId: viewerId, followingId: targetId }
    },
    select: { status: true }
  })
  return row?.status === 'ACCEPTED'
}

/** Mutual accepted follow relationship (either direction counts for messaging). */
export async function canMessage(userA: string, userB: string) {
  if (userA === userB) return false
  const [aFollowsB, bFollowsA] = await Promise.all([
    prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: userA, followingId: userB }
      },
      select: { status: true }
    }),
    prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: userB, followingId: userA }
      },
      select: { status: true }
    })
  ])
  return aFollowsB?.status === 'ACCEPTED' || bFollowsA?.status === 'ACCEPTED'
}

/**
 * Single source of truth for the followers / following lists.
 *  - "followers": users who follow `ownerId`   (Follow.followingId = ownerId)
 *  - "following": users `ownerId` follows      (Follow.followerId  = ownerId)
 * Only ACCEPTED rows count, so the two lists can never contain each other's people.
 * Every returned user carries the *viewer's* relationship flags so the buttons are right.
 *
 * NOTE: this lives OUTSIDE `userService` on purpose. If it were a method of `userService`
 * and called `userService.relationList(...)`, TypeScript could not infer the types
 * (circular reference) and would treat the return type as `void`.
 */
async function relationList(
  viewerId: string | undefined,
  ownerId: string,
  kind: 'followers' | 'following',
  limit = 50,
  cursor?: string
) {
  const followersMode = kind === 'followers'
  const rows = await prisma.follow.findMany({
    where: followersMode
      ? { followingId: ownerId, status: 'ACCEPTED' }
      : { followerId: ownerId, status: 'ACCEPTED' },
    orderBy: [
      { createdAt: 'desc' },
      followersMode ? { followerId: 'desc' } : { followingId: 'desc' }
    ],
    take: limit + 1,
    ...(cursor
      ? {
          cursor: followersMode
            ? {
                followerId_followingId: {
                  followerId: cursor,
                  followingId: ownerId
                }
              }
            : {
                followerId_followingId: {
                  followerId: ownerId,
                  followingId: cursor
                }
              },
          skip: 1
        }
      : {}),
    include: followersMode
      ? { follower: { select: publicSelect } }
      : { following: { select: publicSelect } }
  })

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const users = page.map(r =>
    'follower' in r && followersMode
      ? (r as any).follower
      : (r as any).following
  ) as Array<Prisma.UserGetPayload<{ select: typeof publicSelect }>>

  const ids = users.map(u => u.id)
  const [mine, theirs] =
    viewerId && ids.length
      ? await Promise.all([
          prisma.follow.findMany({
            where: { followerId: viewerId, followingId: { in: ids } },
            select: { followingId: true, status: true }
          }),
          prisma.follow.findMany({
            where: { followingId: viewerId, followerId: { in: ids } },
            select: { followerId: true, status: true }
          })
        ])
      : [[], []]
  const iFollow = new Map(mine.map(r => [r.followingId, r.status]))
  const followsMe = new Map(theirs.map(r => [r.followerId, r.status]))

  const items = users.map(u => ({
    ...u,
    isMe: u.id === viewerId,
    isFollowing: iFollow.get(u.id) === 'ACCEPTED',
    isRequested: iFollow.get(u.id) === 'PENDING',
    isFollower: followsMe.get(u.id) === 'ACCEPTED'
  }))

  const last = page.at(-1) as
    | { followerId: string; followingId: string }
    | undefined
  const nextCursor =
    hasMore && last
      ? followersMode
        ? last.followerId
        : last.followingId
      : null

  return { items, nextCursor }
}

export const userService = {
  async getProfile(username: string, viewerId?: string) {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: profileInclude(viewerId)
    })
    if (!user) throw ApiError.notFound('User not found')
    return toProfile(user, viewerId)
  },

  async updateMe(userId: string, data: Prisma.UserUpdateInput) {
    const user = await prisma.user.update({ where: { id: userId }, data })
    return privateUser(user)
  },

  async updatePrivacy(userId: string, privacy: PrivacyLevel) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { privacy }
    })
    return privateUser(user)
  },

  async touchLastSeen(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() }
    })
  },

  /** People search; with a logged-in viewer every result carries the viewer's follow state. */
  async search(q: string, viewerId?: string) {
    const users = await prisma.user.findMany({
      where: {
        emailVerified: true,
        isActive: true,
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } }
        ]
      },
      select: publicSelect,
      take: 10
    })
    if (!viewerId || !users.length) return users
    const ids = users.map(u => u.id)
    const [mine, theirs] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: viewerId, followingId: { in: ids } },
        select: { followingId: true, status: true }
      }),
      prisma.follow.findMany({
        where: { followingId: viewerId, followerId: { in: ids } },
        select: { followerId: true, status: true }
      })
    ])
    const iFollow = new Map(mine.map(r => [r.followingId, r.status]))
    const followsMe = new Map(theirs.map(r => [r.followerId, r.status]))
    return users.map(u => ({
      ...u,
      isMe: u.id === viewerId,
      isFollowing: iFollow.get(u.id) === 'ACCEPTED',
      isRequested: iFollow.get(u.id) === 'PENDING',
      isFollower: followsMe.get(u.id) === 'ACCEPTED'
    }))
  },

  suggestions: (viewerId: string) =>
    prisma.user.findMany({
      where: {
        id: { not: viewerId },
        emailVerified: true,
        isActive: true,
        followers: { none: { followerId: viewerId } }
      },
      orderBy: { followers: { _count: 'desc' } },
      select: publicSelect,
      take: 8
    }),

  /** People who follow ME (accepted only), each flagged with whether I follow them back. */
  async myFollowers(viewerId: string, limit = 50) {
    return relationList(viewerId, viewerId, 'followers', limit)
  },

  /** People I follow (accepted only — pending requests are NOT counted as following). */
  async myFollowing(viewerId: string, limit = 50) {
    return relationList(viewerId, viewerId, 'following', limit)
  },

  /**
   * Follow = always a REQUEST. The other person gets a notification with Accept / Reject buttons
   * (and the same buttons on the sender's profile). Nothing is followed until it is accepted.
   */
  async follow(viewerId: string, username: string) {
    const target = await findOrFail(username)
    if (target.id === viewerId)
      throw ApiError.badRequest('You cannot follow yourself')

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: viewerId, followingId: target.id }
      }
    })
    if (existing) return { status: existing.status }

    await prisma.follow.create({
      data: { followerId: viewerId, followingId: target.id, status: 'PENDING' }
    })
    await notify({
      recipientId: target.id,
      actorId: viewerId,
      type: 'FOLLOW_REQUEST'
    })
    emitToUser(target.id, 'follow:changed', {})
    return { status: 'PENDING' as const }
  },

  async unfollow(viewerId: string, username: string) {
    const target = await findOrFail(username)
    await prisma.follow.deleteMany({
      where: { followerId: viewerId, followingId: target.id }
    })
    await clearFollowNotifications(target.id, viewerId)
    emitToUser(target.id, 'follow:changed', {})
  },

  /** Remove someone from your followers (they no longer follow you). */
  async removeFollower(viewerId: string, username: string) {
    const target = await findOrFail(username)
    await prisma.follow.deleteMany({
      where: { followerId: target.id, followingId: viewerId }
    })
    await clearFollowNotifications(viewerId, target.id)
    emitToUser(target.id, 'follow:changed', {})
  },

  async cancelRequest(viewerId: string, username: string) {
    const target = await findOrFail(username)
    await prisma.follow.deleteMany({
      where: { followerId: viewerId, followingId: target.id, status: 'PENDING' }
    })
    await clearFollowNotifications(target.id, viewerId, ['FOLLOW_REQUEST'])
    emitToUser(target.id, 'follow:changed', {})
  },

  /**
   * Accept: the follow becomes ACCEPTED and the "wants to follow you" notification instantly turns into
   * a plain "started following you" notification (no more Accept / Reject buttons).
   */
  async acceptRequest(viewerId: string, username: string) {
    const requester = await findOrFail(username)
    const updated = await prisma.follow.updateMany({
      where: {
        followerId: requester.id,
        followingId: viewerId,
        status: 'PENDING'
      },
      data: { status: 'ACCEPTED' }
    })
    if (updated.count === 0)
      throw ApiError.notFound('No pending request from this user')

    const converted = await prisma.notification.updateMany({
      where: {
        recipientId: viewerId,
        actorId: requester.id,
        type: 'FOLLOW_REQUEST'
      },
      data: { type: 'FOLLOW', read: true }
    })
    if (converted.count === 0) {
      await prisma.notification.create({
        data: {
          recipientId: viewerId,
          actorId: requester.id,
          type: 'FOLLOW',
          read: true
        }
      })
    }
    emitToUser(viewerId, 'notification:changed', {})
    emitToUser(viewerId, 'follow:changed', {})

    // Tell the requester it worked
    await notify({
      recipientId: requester.id,
      actorId: viewerId,
      type: 'FOLLOW_ACCEPTED'
    })
    emitToUser(requester.id, 'follow:changed', {})
  },

  async rejectRequest(viewerId: string, username: string) {
    const requester = await findOrFail(username)
    const deleted = await prisma.follow.deleteMany({
      where: {
        followerId: requester.id,
        followingId: viewerId,
        status: 'PENDING'
      }
    })
    if (deleted.count === 0)
      throw ApiError.notFound('No pending request from this user')
    await clearFollowNotifications(viewerId, requester.id, ['FOLLOW_REQUEST'])
    emitToUser(requester.id, 'follow:changed', {})
  },

  async pendingRequests(viewerId: string) {
    const rows = await prisma.follow.findMany({
      where: { followingId: viewerId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { follower: { select: publicSelect } }
    })
    return rows.map(r => r.follower)
  },

  /** Public followers list of any profile (ACCEPTED followers only). */
  followers: (
    username: string,
    cursor: string | undefined,
    limit: number,
    viewerId?: string
  ) =>
    findOrFail(username).then(t =>
      relationList(viewerId, t.id, 'followers', limit, cursor)
    ),

  /** Public following list of any profile (people they follow, ACCEPTED only). */
  following: (
    username: string,
    cursor: string | undefined,
    limit: number,
    viewerId?: string
  ) =>
    findOrFail(username).then(t =>
      relationList(viewerId, t.id, 'following', limit, cursor)
    ),

  /** Followers eligible for messaging (accepted followers of me). */
  async messageableFollowers(viewerId: string) {
    const rows = await prisma.follow.findMany({
      where: { followingId: viewerId, status: 'ACCEPTED' },
      orderBy: { createdAt: 'desc' },
      include: { follower: { select: publicSelect } },
      take: 50
    })
    // Also include people I follow (accepted)
    const outgoing = await prisma.follow.findMany({
      where: { followerId: viewerId, status: 'ACCEPTED' },
      orderBy: { createdAt: 'desc' },
      include: { following: { select: publicSelect } },
      take: 50
    })
    const map = new Map<string, any>()
    for (const r of rows) map.set(r.follower.id, r.follower)
    for (const r of outgoing) map.set(r.following.id, r.following)
    return Array.from(map.values())
  }
}
