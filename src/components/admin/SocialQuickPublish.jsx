import { useState } from 'react'
import { socialAssets } from 'virtual:social-assets'
import {
  PLATFORMS, FORMAT_LABELS, platformOf, formatsFor, usesCaption, composeText, productLink, manualUrl,
} from '@/lib/socialPlatforms'
import { useSocial, socialCall, SOCIAL_MODES } from '@/lib/socialClient'

// Pubblicazione rapida di un asset del prodotto su un social, in due clic:
// icona del social → anteprima (formato, testo pescato dal pool, "altro
// testo") → Pubblica (social collegati via API) o Apri e copia (gli altri).
// Usato in ogni riga della lista prodotti e nella sezione Social della scheda.
// Spec: docs/superpowers/specs/2026-09-30-social-publish-design.md

const SITE = 'https://www.jayl.store'

export default function SocialQuickPublish({ productId }) {
  const assets = socialAssets[productId] || []
  const { status, state, error, refreshState } = useSocial()
  const [sel, setSel] = useState(null)
  const [open, setOpen] = useState(null)
  const [format, setFormat] = useState(null)
  const [caption, setCaption] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)

  if (!assets.length) {
    return <p className="text-[10px] text-gray-600 mt-1.5">Social: nessuna foto o video importato</p>
  }

  const asset = assets.find((a) => a.src === sel) || assets[0]
  const platform = open ? platformOf(open) : null
  const pStatus = (open && status?.platforms?.[open]) || null
  const mode = pStatus?.mode || 'manual'
  const needsText = !!format && usesCaption(format)
  const unused = (open && state?.captions?.[productId]?.[open]?.unused) ?? null

  const pickCaption = async (key, after = null) => {
    setBusy('caption'); setMsg(null)
    try {
      const r = await socialCall('caption', { productId, platform: key, after })
      setCaption(r.caption)
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy('')
    }
  }

  const openPlatform = (key) => {
    if (open === key) { setOpen(null); return }
    const f = formatsFor(key, asset.type)[0] || null
    setOpen(key); setFormat(f); setMsg(null)
    const cached = state?.captions?.[productId]?.[key]?.next || null
    setCaption(cached)
    if (f && usesCaption(f) && !cached) pickCaption(key)
  }

  const selectAsset = (a) => {
    setSel(a.src); setMsg(null)
    if (open) {
      const f = formatsFor(open, a.type)[0] || null
      setFormat(f)
      if (f && usesCaption(f) && !caption) pickCaption(open)
    }
  }

  const selectFormat = (f) => {
    setFormat(f); setMsg(null)
    if (usesCaption(f) && !caption) pickCaption(open)
  }

  const publish = async () => {
    setBusy('publish'); setMsg(null)
    try {
      const r = await socialCall('publish', {
        productId, asset: asset.src, platform: open, format, captionId: needsText ? caption?.id : undefined,
      })
      setMsg({ ok: true, text: `Pubblicato su ${platform.label}`, url: r.result?.url })
      setCaption(null)
      refreshState()
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy('')
    }
  }

  const openAndCopy = async () => {
    setBusy('open'); setMsg(null)
    const text = needsText && caption ? composeText(open, caption) : ''
    const titled = caption?.title && (open === 'pinterest' || open === 'youtube') ? `${caption.title}\n\n${text}` : text
    let copied = false
    if (titled) { try { await navigator.clipboard.writeText(titled); copied = true } catch { /* il browser può negarlo */ } }
    const media = SITE + (asset.type === 'image' ? (asset.jpg || asset.src) : asset.src)
    window.open(manualUrl(open, { text, link: productLink(productId, open, format), media }), '_blank', 'noopener,noreferrer')
    try {
      await socialCall('mark-used', {
        productId, asset: asset.src, platform: open, format, captionId: needsText ? caption?.id : null,
      })
      setMsg({ ok: true, text: copied ? 'Testo copiato: incollalo nel post' : titled ? 'Copia il testo qui sopra a mano' : 'Aperto' })
      setCaption(null)
      refreshState()
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="mt-2 space-y-2 cursor-default" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Asset del prodotto: prima i video, poi le foto. */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide min-w-0 flex-1 basis-40">
          {assets.map((a) => (
            <button
              key={a.src}
              type="button"
              onClick={() => selectAsset(a)}
              title={a.src.split('/').pop()}
              className={`relative flex-shrink-0 w-10 h-10 overflow-hidden border ${a.src === asset.src ? 'border-emerald-400' : 'border-gray-700 hover:border-gray-500'}`}
            >
              {a.type === 'video' ? (
                <>
                  <video src={a.src} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-[10px]">▶</span>
                </>
              ) : (
                <img src={a.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>

        {/* Social: il pallino dice cosa succede al clic. */}
        <div className="flex gap-1 flex-shrink-0">
          {PLATFORMS.map((p) => {
            const s = status?.platforms?.[p.key]
            const m = SOCIAL_MODES[s?.mode] || null
            const can = formatsFor(p.key, asset.type).length > 0
            return (
              <button
                key={p.key}
                type="button"
                disabled={!can}
                onClick={() => openPlatform(p.key)}
                title={!can
                  ? `${p.label}: non accetta ${asset.type === 'video' ? 'video' : 'immagini'}`
                  : `${p.label} · ${m ? m.label : (error ? 'stato non disponibile' : 'controllo…')}${s?.detail ? ` · ${s.detail}` : ''}`}
                className={`relative w-8 h-8 text-[10px] font-bold border transition-colors disabled:opacity-20 ${open === p.key ? 'bg-gray-800' : 'hover:bg-gray-900'}`}
                style={{ borderColor: p.color + '88', color: p.color }}
              >
                {p.short}
                <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${m ? m.dot : 'bg-gray-800'}`} />
              </button>
            )
          })}
        </div>
      </div>

      {open && (
        <div className="border border-gray-800 bg-black/50 p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold" style={{ color: platform.color }}>{platform.label}</span>
            <span className="text-[10px] text-gray-500">
              {SOCIAL_MODES[mode]?.label}{pStatus?.detail ? ` · ${pStatus.detail}` : ''}
            </span>
            <button type="button" onClick={() => setOpen(null)} className="ml-auto text-gray-500 hover:text-white text-xs" title="Chiudi">✕</button>
          </div>

          {formatsFor(open, asset.type).length > 1 && (
            <div className="flex gap-1">
              {formatsFor(open, asset.type).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => selectFormat(f)}
                  className={`px-2 py-0.5 text-[11px] border ${f === format ? 'border-white text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                >{FORMAT_LABELS[f]}</button>
              ))}
            </div>
          )}

          {needsText ? (
            caption ? (
              <div className="text-xs space-y-1">
                {caption.title && <p className="text-gray-200 font-semibold">{caption.title}</p>}
                <p className="text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto">{composeText(open, caption)}</p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">{busy === 'caption' ? 'Pesco un testo mai usato…' : 'Nessun testo'}</p>
            )
          ) : (
            <p className="text-[11px] text-gray-500">Le storie si pubblicano senza testo.</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {needsText && (
              <button type="button" onClick={() => pickCaption(open, caption?.id || null)} disabled={!!busy}
                className="text-[11px] text-gray-400 hover:text-white disabled:opacity-40">↻ altro testo</button>
            )}
            {needsText && unused !== null && <span className="text-[10px] text-gray-600">{unused} non usati</span>}
            {mode === 'api' ? (
              <button type="button" onClick={publish} disabled={!!busy || (needsText && !caption)}
                className="ml-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5">
                {busy === 'publish' ? 'Pubblico…' : `Pubblica ${FORMAT_LABELS[format] || ''}`}
              </button>
            ) : (
              <button type="button" onClick={openAndCopy} disabled={!!busy || (needsText && !caption)}
                className="ml-auto border border-gray-600 hover:bg-gray-800 disabled:opacity-40 text-gray-200 text-xs font-semibold px-3 py-1.5">
                Apri e copia
              </button>
            )}
          </div>
          {busy === 'publish' && asset.type === 'video' && (
            <p className="text-[10px] text-gray-500">I video li elabora il social: può volerci un minuto.</p>
          )}
          {msg && (
            <p className={`text-[11px] ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {msg.text}{' '}
              {msg.url && <a href={msg.url} target="_blank" rel="noopener noreferrer" className="underline">Vedi →</a>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
