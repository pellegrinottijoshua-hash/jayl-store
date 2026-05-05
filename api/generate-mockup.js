import { applyCors } from './_lib/cors.js'

// Base model IDs accepted from the frontend
const IMAGE_MODELS = new Set([
  'fal-ai/flux/schnell',
  'fal-ai/flux-pro/v1.1',
  'fal-ai/flux-pro',        // legacy
  'fal-ai/flux/dev',        // legacy
  'fal-ai/ideogram/v3',
  'fal-ai/nano-banana-2',
  'fal-ai/recraft-v3',
])

// Flux t2i base endpoints silently ignore image_url.
// Switch to their dedicated img2img (redux) variants when a reference image is provided.
const T2I_TO_I2I = {
  'fal-ai/flux/schnell':  'fal-ai/flux/schnell-redux',
  'fal-ai/flux-pro/v1.1': 'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux-pro':      'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux/dev':      'fal-ai/flux/dev-redux',
}

// Redux img2img models accept image_url but NOT a strength param
// (they condition on the image style, not blend by strength)
const REDUX_MODELS = new Set([
  'fal-ai/flux/schnell-redux',
  'fal-ai/flux-pro/v1.1-redux',
  'fal-ai/flux/dev-redux',
])

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed)                 return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = (process.env.FAL_KEY || process.env.FALAI_API_KEY || '').trim()
  if (!apiKey) return res.status(500).json({ error: 'FAL_KEY not configured' })

  const { modelId, prompt, imageSize, imageUrl } = req.body || {}
  if (!prompt?.trim())            return res.status(400).json({ error: 'prompt is required' })
  if (!IMAGE_MODELS.has(modelId)) return res.status(400).json({ error: `Unknown model: ${modelId}` })

  // When a reference image is supplied, route Flux models to their img2img (redux) variants.
  // Other models (Ideogram, Recraft, Nano Banana) accept image_url natively on their base endpoint.
  const effectiveModelId = (imageUrl && T2I_TO_I2I[modelId]) ? T2I_TO_I2I[modelId] : modelId
  const isRedux = REDUX_MODELS.has(effectiveModelId)

  // Build img reference payload:
  //   Redux → image_url only (no strength — style conditioning, not blending)
  //   Native i2i → image_url + strength
  const imagePayload = imageUrl
    ? isRedux
      ? { image_url: imageUrl }
      : { image_url: imageUrl, strength: 0.85 }
    : {}

  try {
    const falRes = await fetch(`https://fal.run/${effectiveModelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt:                prompt.trim(),
        image_size:            imageSize || 'square_hd',
        num_images:            1,
        enable_safety_checker: false,
        ...imagePayload,
      }),
    })

    const body = await falRes.json().catch(() => null)

    if (!falRes.ok) {
      console.error('[generate-mockup] fal error', falRes.status, body)
      return res.status(falRes.status).json({
        error: body?.detail || body?.message || `fal.ai error ${falRes.status}`,
      })
    }

    const imageUrlOut = body?.images?.[0]?.url ?? body?.image?.url ?? null
    if (!imageUrlOut) {
      console.error('[generate-mockup] unexpected response', JSON.stringify(body).slice(0, 300))
      return res.status(500).json({ error: 'No image URL in fal.ai response' })
    }

    return res.status(200).json({ imageUrl: imageUrlOut })
  } catch (err) {
    console.error('[generate-mockup]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
