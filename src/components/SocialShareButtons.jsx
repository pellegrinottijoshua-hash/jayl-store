import { useState, useMemo } from 'react'
import { SOCIAL_LINKS } from '@/data/social-links'

// ──────────────────────────────────────────────────────────────────────────────
// 4 redirect/share buttons for Pinterest · Facebook · Instagram · TikTok.
// No platform API/token needed — each button opens the platform's compose/upload
// page (the user authenticates there) and prefills as much as the web allows.
//
// You pick WHICH asset to publish (image or video) from the thumbnail strip, and
// title / description / alt text / tags are prepared:
//   • Pinterest → opens the pin-builder with the SELECTED image + a description
//     that folds in title + body + hashtags. Title & Alt also land on the
//     clipboard (Pinterest's URL builder can't pre-fill those two fields).
//   • Facebook  → shares the product link; all fields copied to clipboard.
//   • Instagram / TikTok → no web prefill exists → all fields copied to clipboard.
// A "Campi pronti" panel lets you copy Title / Description / Alt / Tags one by one.
//
// Platform targets (instagram/tiktok/facebook profiles) read from social-links.js.
// ──────────────────────────────────────────────────────────────────────────────

const enc = encodeURIComponent
const abs = (u) => !u ? '' : (/^https?:\/\//i.test(u) ? u : `https://jayl.store${u.startsWith('/') ? '' : '/'}${u}`)
const isVideo = (u = '') => /\.(mp4|mov|webm)$/i.test(u) || /youtube|youtu\.be|vimeo/i.test(u)

const PLATFORMS = [
  { key: 'pinterest', label: 'Pinterest', color: '#e60023', emoji: '📌', mode: 'prefill ✓'    },
  { key: 'facebook',  label: 'Facebook',  color: '#1877f2', emoji: '📘', mode: 'link'          },
  { key: 'instagram', label: 'Instagram', color: '#e1306c', emoji: '📸', mode: 'copia campi'   },
  { key: 'tiktok',    label: 'TikTok',    color: '#25f4ee', emoji: '🎵', mode: 'copia campi'   },
]

export default function SocialShareButtons({
  productUrl = 'https://jayl.store',
  assets     = [],          // [{ url, type?, alt? }] — images and/or videos to choose from
  imageUrl   = '',          // legacy single fallback if `assets` is empty
  title      = '',
  tags       = [],          // array OR comma-separated string
  altText    = '',          // global fallback alt
  captions   = {},          // { pinterest, instagram, tiktok }
  links      = SOCIAL_LINKS,
}) {
  // Normalise + de-dupe the asset list
  const list = useMemo(() => {
    const raw = (assets && assets.length ? assets : (imageUrl ? [{ url: imageUrl }] : []))
      .filter(a => a && a.url)
    const seen = new Set(); const out = []
    for (const a of raw) {
      if (seen.has(a.url)) continue
      seen.add(a.url)
      out.push({ ...a, type: a.type || (isVideo(a.url) ? 'video' : 'image') })
    }
    return out
  }, [assets, imageUrl])

  const [selUrl, setSelUrl] = useState('')
  const [msg, setMsg]       = useState('')
  const [showFields, setShowFields] = useState(false)

  const sel = list.find(a => a.url === selUrl) || list[0] || null

  const flash = (t) => { setMsg(t); window.clearTimeout(flash._t); flash._t = window.setTimeout(() => setMsg(''), 4500) }
  const copy  = async (t) => { try { await navigator.clipboard.writeText(t || '') ; return true } catch { return false } }
  const open  = (url) => window.open(url, '_blank', 'noopener,noreferrer')

  const tagArr   = Array.isArray(tags) ? tags : String(tags || '').split(',').map(t => t.trim()).filter(Boolean)
  const hashtags = tagArr.map(t => '#' + t.replace(/[^a-z0-9]+/gi, '')).filter(h => h.length > 1).join(' ')
  const desc     = captions.pinterest || captions.instagram || ''
  const selAlt   = (sel && sel.alt) || altText || ''
  const media    = abs(sel?.url || '')
  const url      = abs(productUrl)

  // Structured block (everything) — copied on every share so title/alt/tags are pasteable
  const fieldsBlock = [
    title    && `TITLE:\n${title}`,
    desc     && `DESCRIPTION:\n${desc}`,
    selAlt   && `ALT TEXT:\n${selAlt}`,
    tagArr.length && `TAGS:\n${tagArr.join(', ')}`,
  ].filter(Boolean).join('\n\n')

  const handle = async (p) => {
    await copy(fieldsBlock)
    if (p.key === 'pinterest') {
      const pinDesc = [title, captions.pinterest || desc, hashtags].filter(Boolean).join('\n\n').slice(0, 480)
      if (sel?.type === 'video') {
        open('https://www.pinterest.com/pin-creation-tool/')
        flash('🎬 Video: si carica a mano in "Crea Pin". Titolo/descrizione/alt/tag copiati negli appunti.')
      } else {
        open(`https://www.pinterest.com/pin/create/button/?url=${enc(url)}&media=${enc(media)}&description=${enc(pinDesc)}`)
        flash('📌 Pinterest: immagine scelta + titolo/descrizione/tag precompilati. Titolo e ALT anche negli appunti.')
      }
    } else if (p.key === 'facebook') {
      open(`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`)
      flash('📘 Facebook aperto col link. Tutti i campi copiati negli appunti.')
    } else if (p.key === 'instagram') {
      open(links?.instagram || 'https://www.instagram.com/')
      flash('📸 Tutti i campi copiati — incollali nel post Instagram.')
    } else if (p.key === 'tiktok') {
      open(links?.tiktok || 'https://www.tiktok.com/upload?lang=it')
      flash('🎵 Tutti i campi copiati — incollali nel post TikTok.')
    }
  }

  const copyField = async (label, val) => { if (await copy(val)) flash(`⎘ ${label} copiato`) }

  return (
    <div className="border border-gray-800 bg-[#0a0a0a] p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider">Condividi sui social</p>
        <span className="text-[9px] text-gray-600">redirect · nessuna API</span>
      </div>

      {/* Asset picker — choose which image/video to publish */}
      {list.length > 0 ? (
        <div>
          <p className="text-[10px] text-gray-600 mb-1">Asset da pubblicare {sel?.type === 'video' && <span className="text-amber-400">· video</span>}</p>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {list.map(a => {
              const active = a.url === (sel?.url)
              return (
                <button
                  key={a.url}
                  type="button"
                  onClick={() => setSelUrl(a.url)}
                  title={a.type === 'video' ? 'Video' : 'Immagine'}
                  className={`relative flex-shrink-0 w-12 h-12 overflow-hidden border-2 transition-colors ${active ? 'border-emerald-500' : 'border-[#252525] hover:border-[#444]'}`}
                >
                  {a.type === 'video'
                    ? <span className="w-full h-full flex items-center justify-center text-base bg-black">🎬</span>
                    : <img src={a.url} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.opacity = 0.25 }} />}
                  {active && <span className="absolute bottom-0 right-0 bg-emerald-500 text-black text-[8px] leading-none px-0.5">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-gray-600 italic">Nessun asset disponibile — carica o genera un'immagine prima.</p>
      )}

      {/* 4 platform buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PLATFORMS.map(p => {
          const connected = !!(links?.[p.key])
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handle(p)}
              disabled={list.length === 0 && p.key === 'pinterest'}
              title={
                p.key === 'pinterest' ? 'Apre il pin-builder con l’immagine scelta + titolo/descrizione/tag; titolo e alt negli appunti'
                : p.key === 'facebook' ? 'Condivide il link del prodotto (tutti i campi copiati)'
                : 'Apre la piattaforma e copia tutti i campi negli appunti'
              }
              className="flex flex-col items-center gap-0.5 border px-2 py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-30 cursor-pointer"
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

      {/* Campi pronti — copy each field individually (Title / Description / Alt / Tags) */}
      <div>
        <button type="button" onClick={() => setShowFields(s => !s)}
          className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
          {showFields ? '▾' : '▸'} Campi pronti (titolo · descrizione · alt · tag)
        </button>
        {showFields && (
          <div className="mt-1.5 space-y-1 text-[11px]">
            {[
              ['Titolo', title],
              ['Descrizione', desc],
              ['Alt text', selAlt],
              ['Tag', tagArr.join(', ')],
            ].map(([label, val]) => (
              <div key={label} className="flex items-start gap-2">
                <span className="w-20 flex-shrink-0 text-gray-600">{label}</span>
                <span className="flex-1 text-gray-400 truncate">{val || <span className="text-gray-700 italic">vuoto</span>}</span>
                {val && (
                  <button type="button" onClick={() => copyField(label, val)}
                    className="flex-shrink-0 text-gray-600 hover:text-emerald-400">⎘</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600 leading-relaxed">
        Instagram/TikTok non permettono prefill via web → apriamo la pagina e copiamo i campi.
        Collega i profili in <span className="text-gray-400">Admin → Settings → Social Links</span>.
      </p>
    </div>
  )
}
