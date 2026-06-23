import { useState } from 'react'
import { SOCIAL_LINKS } from '@/data/social-links'

// ──────────────────────────────────────────────────────────────────────────────
// 4 redirect/share buttons for Pinterest · Facebook · Instagram · TikTok.
// No platform API/token needed — each button opens the platform's compose/upload
// page (the user authenticates there) and prefills as much as the web allows:
//   • Pinterest → full prefill (link + image + description) via the pin-builder URL
//   • Facebook  → shares the product link (text copied to clipboard as helper)
//   • Instagram / TikTok → no web prefill exists, so we copy the caption to the
//     clipboard and open the platform (the user's profile if configured below).
//
// "Predisposizione al collegamento": each platform target is read from
// src/data/social-links.js (Admin → Settings → Social Links). Leave them empty
// now and fill them later — the buttons already work, they'll just point at the
// generic platform pages until a profile URL is set.
// ──────────────────────────────────────────────────────────────────────────────

const enc = encodeURIComponent
const abs = (u) => !u ? '' : (/^https?:\/\//i.test(u) ? u : `https://jayl.store${u.startsWith('/') ? '' : '/'}${u}`)

const PLATFORMS = [
  { key: 'pinterest', label: 'Pinterest', color: '#e60023', emoji: '📌', mode: 'prefill ✓'   },
  { key: 'facebook',  label: 'Facebook',  color: '#1877f2', emoji: '📘', mode: 'link'         },
  { key: 'instagram', label: 'Instagram', color: '#e1306c', emoji: '📸', mode: 'copia caption'},
  { key: 'tiktok',    label: 'TikTok',    color: '#25f4ee', emoji: '🎵', mode: 'copia caption'},
]

export default function SocialShareButtons({
  productUrl = 'https://jayl.store',
  imageUrl   = '',
  captions   = {},            // { pinterest, instagram, tiktok }
  links      = SOCIAL_LINKS,
}) {
  const [msg, setMsg] = useState('')
  const flash = (t) => { setMsg(t); window.clearTimeout(flash._t); flash._t = window.setTimeout(() => setMsg(''), 4000) }
  const copy  = async (t) => { try { await navigator.clipboard.writeText(t || '') } catch { /* clipboard blocked */ } }
  const open  = (url) => window.open(url, '_blank', 'noopener,noreferrer')

  const url   = abs(productUrl)
  const media = abs(imageUrl)
  const capP  = captions.pinterest || ''
  const capI  = captions.instagram || captions.pinterest || ''
  const capT  = captions.tiktok    || captions.instagram || ''

  const handle = async (p) => {
    if (p.key === 'pinterest') {
      open(`https://www.pinterest.com/pin/create/button/?url=${enc(url)}&media=${enc(media)}&description=${enc(capP)}`)
      flash('📌 Pinterest aperto: link, immagine e descrizione precompilati.')
    } else if (p.key === 'facebook') {
      await copy(capP || capI)
      open(`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`)
      flash('📘 Facebook aperto col link. Testo copiato negli appunti.')
    } else if (p.key === 'instagram') {
      await copy(capI)
      open(links?.instagram || 'https://www.instagram.com/')
      flash('📸 Caption copiata — incollala nel post Instagram.')
    } else if (p.key === 'tiktok') {
      await copy(capT)
      open(links?.tiktok || 'https://www.tiktok.com/upload?lang=it')
      flash('🎵 Caption copiata — incollala nel post TikTok.')
    }
  }

  return (
    <div className="border border-gray-800 bg-[#0a0a0a] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider">Condividi sui social</p>
        <span className="text-[9px] text-gray-600">redirect · nessuna API</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PLATFORMS.map(p => {
          const connected = !!(links?.[p.key])
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handle(p)}
              title={
                p.key === 'pinterest' ? 'Apre il pin-builder con link + immagine + descrizione già compilati'
                : p.key === 'facebook' ? 'Condivide il link del prodotto (testo copiato negli appunti)'
                : 'Apre la piattaforma e copia la caption negli appunti (il web non permette prefill)'
              }
              className="flex flex-col items-center gap-0.5 border px-2 py-2 text-xs font-semibold transition-opacity hover:opacity-80 cursor-pointer"
              style={{ borderColor: p.color + '66', color: p.color }}
            >
              <span className="text-base leading-none">{p.emoji}</span>
              <span>{p.label}</span>
              <span className="text-[8px] text-gray-600 flex items-center gap-1">
                {p.mode}{connected && <span title="profilo collegato" style={{ color: p.color }}>●</span>}
              </span>
            </button>
          )
        })}
      </div>

      {msg && <p className="text-[11px] text-emerald-400">{msg}</p>}

      <p className="text-[10px] text-gray-600 leading-relaxed">
        Instagram e TikTok non permettono prefill via web: apriamo la pagina di pubblicazione e copiamo la caption.
        Collega i tuoi profili in <span className="text-gray-400">Admin → Settings → Social Links</span> (predisposizione già pronta) per puntare ai tuoi account.
      </p>
    </div>
  )
}
