import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma'
import {
  deleteVideo,
  createVideoUploadSignature,
  createImageUploadSignature,
  ownsVideo
} from '../../lib/cloudinary'
import { requireAuth } from '../../middleware/auth'
import { uploadLimiter } from '../../middleware/rateLimit'
import { validate } from '../../middleware/validate'
import { ApiError } from '../../utils/ApiError'
import { message, ok, userId } from '../../utils/response'

const router = Router()

// সব আপলোড রুটে লগইন লাগবে
router.use(requireAuth)

/**
 * POST /api/uploads/image-signature
 * Browser Cloudinary-তে সরাসরি image আপলোড করার জন্য signature
 */
router.post('/image-signature', uploadLimiter, (req, res) => {
  ok(res, createImageUploadSignature(userId(req)))
})

/**
 * POST /api/uploads/video-signature
 * Browser Cloudinary-তে সরাসরি video আপলোড করার জন্য signature
 */
router.post('/video-signature', uploadLimiter, (req, res) => {
  ok(res, createVideoUploadSignature(userId(req)))
})

/**
 * POST /api/uploads/imgbb
 * Frontend base64 পাঠায় → backend ImgBB-তে আপলোড করে → URL ফেরত দেয়
 */
router.post('/imgbb', uploadLimiter, async (req, res) => {
  try {
    const { imageBase64 } = req.body ?? {}
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res
        .status(400)
        .json({ success: false, message: 'imageBase64 required' })
    }

    const apiKey = process.env.IMGBB_API_KEY
    if (!apiKey) {
      return res
        .status(500)
        .json({ success: false, message: 'IMGBB_API_KEY not configured' })
    }

    const form = new URLSearchParams()
    form.append('key', apiKey)
    form.append('image', imageBase64)

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: form
    })

    // টাইপ বলে দিলাম → unknown এরর যাবে
    const data = (await response.json()) as {
      success: boolean
      error?: { message?: string }
      data?: {
        url: string
        display_url: string
        delete_url?: string
      }
    }

    if (!data.success || !data.data?.url) {
      return res.status(400).json({
        success: false,
        message: data.error?.message || 'ImgBB upload failed'
      })
    }

    ok(res, {
      url: data.data.url,
      displayUrl: data.data.display_url,
      deleteUrl: data.data.delete_url
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    res.status(500).json({ success: false, message })
  }
})

const discardSchema = z.object({
  publicId: z.string().min(1).max(200)
})

/**
 * DELETE /api/uploads/video  { publicId }
 * Composer থেকে video বাদ দিলে Cloudinary থেকে মুছে ফেলা
 */
router.delete('/video', validate({ body: discardSchema }), async (req, res) => {
  const { publicId } = req.body as z.infer<typeof discardSchema>

  if (!ownsVideo(userId(req), publicId)) {
    throw ApiError.forbidden(
      'This video does not belong to you',
      'VIDEO_NOT_OWNED'
    )
  }

  const used = await prisma.post.findUnique({
    where: { videoPublicId: publicId },
    select: { id: true }
  })

  if (used) {
    throw ApiError.conflict(
      'This video is attached to a post. Delete the post instead.'
    )
  }

  await deleteVideo(publicId)
  message(res, 'Video discarded')
})

export default router
