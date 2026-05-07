// ── Shared constants & helpers for Generate Assets panels ────────────────────

export const ADMIN_PASSWORD = 'jaylpelle'

// ── Social platform metadata ────────────────────────────────────────────────
export const SOCIAL_META = {
  tiktok:    { icon: '🎵', label: 'TikTok',    color: 'text-pink-400',   activeBg: 'bg-pink-900/30',    activeBorder: 'border-pink-600',    videoCount: 3 },
  instagram: { icon: '📸', label: 'Instagram',  color: 'text-purple-400', activeBg: 'bg-purple-900/30',  activeBorder: 'border-purple-600',  videoCount: 2 },
  pinterest: { icon: '📌', label: 'Pinterest',  color: 'text-red-400',    activeBg: 'bg-red-900/30',     activeBorder: 'border-red-600',     videoCount: 0 },
  facebook:  { icon: '👥', label: 'Facebook',   color: 'text-blue-400',   activeBg: 'bg-blue-900/30',    activeBorder: 'border-blue-600',    videoCount: 2 },
  site:      { icon: '🌐', label: 'Site',       color: 'text-indigo-400', activeBg: 'bg-indigo-900/30',  activeBorder: 'border-indigo-600',  videoCount: 2 },
  youtube:   { icon: '▶',  label: 'YouTube',    color: 'text-red-500',    activeBg: 'bg-red-900/20',     activeBorder: 'border-red-700',     videoCount: 3 },
}

// ── Product type metadata ────────────────────────────────────────────────────
export const PRODUCT_TYPE_META = {
  tshirt: { icon: '👕', label: 'T-Shirt'   },
  mug:    { icon: '☕', label: 'Mug'       },
  art:    { icon: '🖼️', label: 'Art Print' },
  tote:   { icon: '👜', label: 'Tote Bag'  },
}

export async function api(action, data) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: ADMIN_PASSWORD, ...data }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

export const btnPrimary = 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer'
export const btnGhost   = 'border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 px-3 py-1.5 text-xs transition-colors cursor-pointer'

export const IMAGE_MODELS = [
  { id: 'fal-ai/nano-banana-pro',           label: 'Nano Banana Pro', cost: '$0.12/img', badge: '🍌 #1',   i2iMode: 'edit'  },
  { id: 'fal-ai/nano-banana-2',             label: 'Nano Banana 2',   cost: '$0.08/img', badge: '🍌',       i2iMode: 'edit'  },
  { id: 'openai/gpt-image-1',               label: 'GPT Image 1',     cost: '$0.04/img', badge: '★',        i2iMode: 'edit'  },
  { id: 'openai/gpt-image-2/edit',          label: 'GPT Image 2',     cost: '$0.08/img', badge: '★ New',    i2iMode: 'edit'  },
  { id: 'fal-ai/flux-pro/kontext',          label: 'Kontext Pro',     cost: '$0.08/img', badge: '✦',        i2iMode: 'edit'  },
  { id: 'fal-ai/flux-pro/kontext/max',      label: 'Kontext Max',     cost: '$0.16/img', badge: '✦ HQ',     i2iMode: 'edit'  },
  { id: 'fal-ai/ideogram/v3',               label: 'Ideogram V3',     cost: '$0.08/img', badge: '✏ Text',  i2iMode: 'remix' },
  { id: 'fal-ai/flux/schnell',              label: 'Flux Schnell',    cost: '$0.003/img', badge: '⚡ Fast', i2iMode: 'redux' },
  { id: 'fal-ai/flux-pro/v1.1',             label: 'Flux Pro 1.1',    cost: '$0.04/img',                    i2iMode: 'redux' },
]

export const VIDEO_MODELS = [
  { id: 'fal-ai/ltx-video/image-to-video',                  label: 'LTX Video',      secRate: 0.002, badge: '⚡ Free-tier' },
  { id: 'fal-ai/bytedance/seedance-2.0/image-to-video',     label: 'Seedance 2.0',   secRate: 0.07  },
  { id: 'fal-ai/kling-video/v3/pro/image-to-video',         label: 'Kling 3.0 Pro',  secRate: 0.224 },
  { id: 'fal-ai/wan/v2.7/reference-to-video',               label: 'Wan 2.7 Ref',    secRate: 0.06  },
]

export const IMAGE_SIZES = [
  { id: 'square_hd',      label: '1:1',  desc: '1024×1024' },
  { id: 'portrait_16_9',  label: '9:16', desc: '576×1024'  },
  { id: 'landscape_16_9', label: '16:9', desc: '1024×576'  },
  { id: 'portrait_4_3',   label: '3:4',  desc: '768×1024'  },
  { id: 'landscape_4_3',  label: '4:3',  desc: '1024×768'  },
]

export const DESTINATION_META = {
  site:      { icon: '🌐', label: 'Sito',      color: 'text-blue-400'   },
  instagram: { icon: '📸', label: 'Instagram', color: 'text-pink-400'   },
  tiktok:    { icon: '🎵', label: 'TikTok',    color: 'text-gray-300'   },
  youtube:   { icon: '▶',  label: 'YouTube',   color: 'text-red-400'    },
  pinterest: { icon: '📌', label: 'Pinterest', color: 'text-red-300'    },
}

export const subVars = (tmpl, vars) =>
  (tmpl || '')
    .replace(/\{PRODUCT_NAME\}/g,  vars.name       || 'this product')
    .replace(/\{PRODUCT_TYPE\}/g,  vars.type       || 'product')
    .replace(/\{COLOR\}/g,         vars.color      || 'default color')
    .replace(/\{COLLECTION\}/g,    vars.collection || '')

export const toAbsoluteUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${window.location.origin}${url}`
}

export async function downloadAsset(url, filename) {
  let href

  if (url.startsWith('data:')) {
    // Base64 data URL — decode directly (no fetch needed)
    const [header, b64] = url.split(',')
    const mime  = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    href = URL.createObjectURL(new Blob([bytes], { type: mime }))
  } else if (url.startsWith('http://') || url.startsWith('https://')) {
    // External URL — route through server proxy to avoid CORS issues
    href = `/api/download-proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
  } else {
    // Relative / same-origin — fetch directly
    try {
      const blob = await fetch(url).then(r => r.blob())
      href = URL.createObjectURL(blob)
    } catch {
      href = url
    }
  }

  const a = document.createElement('a')
  a.href     = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  if (href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(href), 1000)
}
