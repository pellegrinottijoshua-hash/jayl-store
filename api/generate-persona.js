import { applyCors } from './_lib/cors.js'

export default async function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(allowed ? 200 : 403).end()
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  const { seed } = req.body || {}
  if (!seed?.trim()) return res.status(400).json({ error: 'seed description required' })

  const prompt = `You are creating a fictional social media influencer persona for JAYL, a premium art and objects store.
The persona will be used to market products on Instagram, TikTok, and YouTube.

Seed description from the store owner: "${seed.trim()}"

Create a fully fleshed-out influencer persona. Return a JSON object with these exact keys:

- "name": First name only (real-sounding, matches the vibe). No last name.
- "handle": Social handle (e.g. "@luna.vibes") — lowercase, no spaces, include @
- "bio": Short Instagram bio (max 150 chars). Emojis allowed. Should feel authentic and personal.
- "personality": 2-3 sentences describing their personality, tone, and how they communicate with followers.
- "aesthetic": 2-3 sentences describing their visual aesthetic — colours, lighting, settings, composition style.
- "contentStyle": 2-3 sentences describing the type of content they post — formats, themes, recurring elements.
- "targetAudience": One sentence describing their target audience (age range, interests, psychographics).
- "promptContext": A single compact string (max 80 chars) summarising their visual style for AI image generation. Example: "dark moody urban aesthetic, high contrast, neon accents, cinematic lighting"

Return ONLY the JSON object, no markdown, no extra text.`

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.9,
        max_tokens: 700,
      }),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}))
      throw new Error(`OpenAI error ${openaiRes.status}: ${err.error?.message || 'Unknown'}`)
    }

    const data    = await openaiRes.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')

    const parsed = JSON.parse(content)
    return res.status(200).json(parsed)
  } catch (err) {
    console.error('[generate-persona]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
