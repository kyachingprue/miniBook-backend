import { Router } from 'express'
import { optionalAuth, requireAuth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import {
  message,
  ok,
  paginationQuery,
  userId,
  usernameParam
} from '../../utils/response'
import { postService } from '../posts/post.service'
import { feedQuery } from '../posts/post.schema'
import {
  searchUsersQuery,
  updateProfileSchema,
  updatePrivacySchema
} from './user.schema'
import { userService } from './user.service'

const router = Router()
type Page = { cursor?: string; limit: number }

// Fixed paths first
router.get(
  '/search',
  validate({ query: searchUsersQuery }),
  optionalAuth,
  async (req, res) => {
    ok(
      res,
      await userService.search((req.query as { q: string }).q, req.user?.id)
    )
  }
)

router.get('/suggestions', requireAuth, async (req, res) => {
  ok(res, await userService.suggestions(userId(req)))
})

router.get('/me/following', requireAuth, async (req, res) => {
  ok(res, (await userService.myFollowing(userId(req))).items)
})

router.get('/me/followers', requireAuth, async (req, res) => {
  ok(res, (await userService.myFollowers(userId(req))).items)
})

router.get('/me/requests', requireAuth, async (req, res) => {
  ok(res, await userService.pendingRequests(userId(req)))
})

router.get('/me/messageable', requireAuth, async (req, res) => {
  ok(res, await userService.messageableFollowers(userId(req)))
})

router.patch(
  '/me',
  requireAuth,
  validate({ body: updateProfileSchema }),
  async (req, res) => {
    ok(res, await userService.updateMe(userId(req), req.body))
  }
)

router.patch(
  '/me/privacy',
  requireAuth,
  validate({ body: updatePrivacySchema }),
  async (req, res) => {
    ok(res, await userService.updatePrivacy(userId(req), req.body.privacy))
  }
)

router.get(
  '/:username',
  validate({ params: usernameParam }),
  optionalAuth,
  async (req, res) => {
    ok(
      res,
      await userService.getProfile(req.params.username as string, req.user?.id)
    )
  }
)

router.get(
  '/:username/posts',
  validate({ params: usernameParam, query: feedQuery }),
  optionalAuth,
  async (req, res) => {
    const { cursor, limit } = req.query as unknown as Page
    const { items, nextCursor } = await postService.list({
      viewerId: req.user?.id,
      username: (req.params.username as string).toLowerCase(),
      cursor,
      limit
    })
    ok(res, items, { nextCursor })
  }
)

router.get(
  '/:username/followers',
  validate({ params: usernameParam, query: paginationQuery }),
  optionalAuth,
  async (req, res) => {
    const { cursor, limit } = req.query as unknown as Page
    const { items, nextCursor } = await userService.followers(
      req.params.username as string,
      cursor,
      limit,
      req.user?.id
    )
    ok(res, items, { nextCursor })
  }
)

router.get(
  '/:username/following',
  validate({ params: usernameParam, query: paginationQuery }),
  optionalAuth,
  async (req, res) => {
    const { cursor, limit } = req.query as unknown as Page
    const { items, nextCursor } = await userService.following(
      req.params.username as string,
      cursor,
      limit,
      req.user?.id
    )
    ok(res, items, { nextCursor })
  }
)

router.post(
  '/:username/follow',
  requireAuth,
  validate({ params: usernameParam }),
  async (req, res) => {
    const result = await userService.follow(
      userId(req),
      req.params.username as string
    )
    ok(res, result)
  }
)

router.delete(
  '/:username/follow',
  requireAuth,
  validate({ params: usernameParam }),
  async (req, res) => {
    await userService.unfollow(userId(req), req.params.username as string)
    message(res, 'Unfollowed')
  }
)

router.delete(
  '/:username/request',
  requireAuth,
  validate({ params: usernameParam }),
  async (req, res) => {
    await userService.cancelRequest(userId(req), req.params.username as string)
    message(res, 'Request cancelled')
  }
)

router.post(
  '/:username/accept',
  requireAuth,
  validate({ params: usernameParam }),
  async (req, res) => {
    await userService.acceptRequest(userId(req), req.params.username as string)
    message(res, 'Request accepted')
  }
)

router.post(
  '/:username/reject',
  requireAuth,
  validate({ params: usernameParam }),
  async (req, res) => {
    await userService.rejectRequest(userId(req), req.params.username as string)
    message(res, 'Request rejected')
  }
)

router.delete(
  '/:username/follower',
  requireAuth,
  validate({ params: usernameParam }),
  async (req, res) => {
    await userService.removeFollower(userId(req), req.params.username as string)
    message(res, 'Follower removed')
  }
)

export default router
