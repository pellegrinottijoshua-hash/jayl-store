import { applyCors } from './_lib/cors.js'

const VIDEO_MODELS = new Set([
  'fal-ai/ltx-video',
  'fal-ai/wan/v2.2/t2v',
  'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
  'fal-ai/kling-video/v1.6/standard/text-to-video',
  'fal-ai/kling-video/v3/pro/text-to-video',
])

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed)                 return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = (process.env.FAL_KEY || process.env.FALAI_API_KEY || '').trim()
  if (!apiKey) return res.status(500).json({ error: 'FAL_KEY not configured' })

  const { action, modelId, prompt, requestId, duration } = req.body || {}
  if (!VIDEO_MODELS.has(modelId)) return res.status(400).json({ error: `Unknown video model: ${modelId}` })

  const baseUrl = `https://queue.fal.run/${modelId}`
  const hdrs    = { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' }
  const dur     = duration || '5'

  try {
    // ── submit ────────────────────────────────────────────────────────────────
    if (action === 'submit') {
      if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' })

      const falRes = await fetch(baseUrl, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ prompt: prompt.trim(), duration: dur }),
      })
      const body = await falRes.json().catch(() => null)
      if (!falRes.ok) {
        console.error('[generate-video] submit error', falRes.status, body)
        return res.status(falRes.status).json({
          error: body?.detail || body?.message || `fal.ai queue error ${falRes.status}`,
        })
      }
      return res.status(200).json({ requestId: body.request_id ?? body.requestId })
    }

    // ── status ────────────────────────────────────────────────────────────────
    if (action === 'status') {
      if (!requestId) return res.status(400).json({ error: 'requestId required' })

      const falRes = await fetch(`${baseUrl}/requests/${requestId}/status`, { headers: hdrs })
      const body   = await falRes.json().catch(() => null)
      if (!falRes.ok) {
        return res.status(falRes.status).json({
          error: body?.detail || `Status check failed ${falRes.status}`,
        })
      }
      return res.status(200).json({ status: body.status, logs: body.logs ?? [] })
    }

    // ── result ────────────────────────────────────────────────────────────────
    if (action === 'result') {
      if (!requestId) return res.status(400).json({ error: 'requestId required' })

      const falRes = await fetch(`${baseUrl}/requests/${requestId}`, { headers: hdrs })
      const body   = await falRes.json().catch(() => null)
      if (!falRes.ok) {
        return res.status(falRes.status).json({
          error: body?.detail || `Result fetch failed ${falRes.status}`,
        })
      }
      const videoUrl = body?.video?.url ?? body?.videos?.[0]?.url ?? null
      if (!videoUrl) {
        console.error('[generate-video] unexpected result', JSON.stringify(body).slice(0, 300))
        return res.status(500).json({ error: 'No video URL in fal.ai response' })
      }
      return res.status(200).json({ videoUrl })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })

  } catch (err) {
    console.error('[generate-video]', action, err.message)
    return res.status(500).json({ error: err.message })
  }
}
