// Testi per il pool social (docs/superpowers/specs/2026-09-30-social-publish-design.md):
// 5 alla volta per prodotto e social, nello stile di quel social, con lo
// stesso brief anti-ripetizione dei testi SEO (api/_lib/textai.js).

import { callTextAIJson, creativeBrief } from './textai.js'

const STYLE = {
  pinterest: 'Pinterest pin. "title": max 90 chars, keyword-first, searchable. "text": 2-3 sentences, 200-450 chars, natural keywords, a soft call to action. "tags": 6-10 lowercase search phrases.',
  instagram: 'Instagram post. "title": a short internal label, max 50 chars. "text": 1-3 short punchy lines, max 300 chars, native Instagram tone. "tags": 8-15 hashtags (words only), niche + broad.',
  facebook:  'Facebook Page post. "title": a short internal label, max 50 chars. "text": 2-4 conversational sentences, max 400 chars, may end with "Shop: jayl.store". "tags": 0-4 hashtags (words only).',
  x:         'X (Twitter) post. "title": a short internal label, max 50 chars. "text": one or two lines, max 200 chars — a link is added after it. "tags": 1-3 hashtags (words only).',
  tiktok:    'TikTok caption. "title": a short internal label, max 50 chars. "text": max 150 chars, native TikTok tone, a hook first. "tags": 4-8 hashtags (words only).',
  youtube:   'YouTube Short. "title": max 90 chars, curiosity + keyword. "text": the description, 2-4 sentences, max 500 chars. "tags": 5-10 keyword tags.',
}

export function buildCaptionPrompt({ product, platform, count = 5, avoid = [] }) {
  const style = STYLE[platform] || STYLE.instagram
  const avoidBlock = avoid.length
    ? `\nAlready written for this product (never repeat these ideas or openings):\n${avoid.map((a) => `- ${a}`).join('\n')}\n`
    : ''
  return `You write social media copy for JAYL, a wearable-art streetwear brand: retro 90s anime-style
character art printed large on the back of heavyweight cotton tees. Dark, chiaroscuro, gallery mood —
art you wear, not merch.

Product: ${product.name}
Collection: ${product.collection || '-'}
About it: ${String(product.description || '').replace(/\s+/g, ' ').slice(0, 600)}

Write exactly ${count} different posts for this platform:
${style}

Rules:
- English only.
- never use the word "drop" (say "new" instead); never mention a price, a discount or shipping costs.
- Each post takes a genuinely different angle (the art, the character, the feeling of wearing it, who it is for, the detail).
- Tags are words or short phrases without the "#" sign.
${avoidBlock}
${creativeBrief()}

Return JSON only: {"posts":[{"title":"","text":"","tags":[""]}]}`
}

/** @returns {Promise<Array<{title:string,text:string,tags:string[]}>>} */
export async function generateCaptions({ product, platform, count = 5, avoid = [] }) {
  const prompt = buildCaptionPrompt({ product, platform, count, avoid })
  const { parsed } = await callTextAIJson(prompt, {
    maxTokens: 1800, temperature: 0.9, frequencyPenalty: 0.4, presencePenalty: 0.3,
  })
  const posts = Array.isArray(parsed?.posts) ? parsed.posts : []
  const clean = posts
    .map((p) => ({
      title: String(p?.title || '').trim(),
      text: String(p?.text || '').trim(),
      tags: Array.isArray(p?.tags) ? p.tags.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean) : [],
    }))
    .filter((p) => p.text)
  if (!clean.length) throw new Error('L\'AI non ha restituito testi utilizzabili')
  return clean.slice(0, count)
}
