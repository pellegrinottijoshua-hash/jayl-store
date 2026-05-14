import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { upload as blobUpload } from '@vercel/blob/client'
import { products as allProducts } from '@/data/products'
import GenerateAssetsTab from '@/components/GenerateAssetsTab'

const ADMIN_PASSWORD = 'jaylpelle'

// ── Helpers ───────────────────────────────────────────────────────────────────

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const fmt = cents => `€${(cents / 100).toFixed(2)}`
const sanitizeFilename = name => name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '')

function parseVideoUrl(url) {
  if (!url) return null
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/)
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] }
  const vmMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vmMatch) return { type: 'vimeo', id: vmMatch[1] }
  if (/\.mp4$/i.test(url)) return { type: 'mp4', src: url }
  return null
}

async function api(action, data, signal) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: ADMIN_PASSWORD, ...data }),
    ...(signal ? { signal } : {}),
  })
  let json
  try { json = await res.json() }
  catch { throw new Error(`Errore server (${res.status}) — verifica che GITHUB_TOKEN sia configurato su Vercel`) }
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// Compress an image file so it fits inside the 3.5 MB base64 limit.
// Videos are returned unchanged (can't compress in the browser).
// Falls back to the original file on any error.
function compressImage(file, maxMB = 3.2) {
  if (!file.type.startsWith('image/')) return Promise.resolve(file)
  if (file.size <= maxMB * 1024 * 1024) return Promise.resolve(file)
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const canvas = document.createElement('canvas')
      const tryCompress = (quality, scale) => {
        canvas.width  = Math.round(width  * scale)
        canvas.height = Math.round(height * scale)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => {
          if (!blob) { resolve(file); return }
          if (blob.size <= maxMB * 1024 * 1024 || quality <= 0.25) {
            const baseName = file.name.replace(/\.[^.]+$/, '')
            resolve(new File([blob], baseName + '.jpg', { type: 'image/jpeg' }))
          } else if (quality > 0.45) {
            tryCompress(quality - 0.15, scale)
          } else {
            tryCompress(quality - 0.1, scale * 0.8)
          }
        }, 'image/jpeg', quality)
      }
      tryCompress(0.85, 1)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-gray-800 border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors'
const btnPrimary = 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer'
const btnDanger  = 'bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer'
const btnGhost   = 'border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 px-3 py-1.5 text-xs transition-colors cursor-pointer'

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-gray-500 text-xs mb-1 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-gray-600 text-xs mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      {title && (
        <p className="text-gray-600 text-xs font-mono uppercase tracking-widest border-b border-gray-800 pb-2">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

// ── Image Pool — left column ───────────────────────────────────────────────────
// Shows ALL image sources: Gelato defaults, uploaded externals, AI-generated.
// Hover each thumbnail to assign it as Hero Desktop/Mobile or add to Sequenza.

function PoolThumb({ img, desktopHero, mobileHero, sequenza, onSetDesktopHero, onSetMobileHero, onToggleSequenza }) {
  const url    = img.url
  const isDesk = desktopHero === url
  const isMob  = mobileHero  === url
  const seqIdx = sequenza.indexOf(url)
  const inSeq  = seqIdx !== -1
  const isVid  = /\.(mp4|mov|webm)$/i.test(url)
  return (
    <div className="relative group flex-shrink-0 w-16 h-16">
      <div className={`w-full h-full border-2 overflow-hidden transition-all ${
        isDesk ? 'border-blue-500' : isMob ? 'border-purple-500' : inSeq ? 'border-emerald-700' : 'border-gray-700'
      }`}>
        {isVid
          ? <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xl">🎬</div>
          : <img src={url} alt={img.name} className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.opacity = '0.3' }} />
        }
      </div>
      {/* Role badges */}
      {isDesk && <div className="absolute top-0 left-0 bg-blue-600 text-white text-[8px] px-0.5 py-px leading-none pointer-events-none z-10">🖥</div>}
      {isMob  && <div className="absolute top-0 right-0 bg-purple-600 text-white text-[8px] px-0.5 py-px leading-none pointer-events-none z-10">📱</div>}
      {inSeq  && <div className="absolute bottom-0 left-0 bg-gray-700 text-white text-[8px] px-1 py-px font-bold leading-none pointer-events-none z-10">{seqIdx + 1}</div>}
      {/* Hover action overlay */}
      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5 z-20">
        <button onClick={() => onSetDesktopHero(isDesk ? null : url)} title="Hero Desktop 16:9"
          className={`w-6 h-6 text-[10px] flex items-center justify-center rounded-sm border transition-colors ${
            isDesk ? 'bg-blue-600 border-blue-500' : 'bg-gray-900 border-gray-600 hover:border-blue-500'
          }`}>🖥</button>
        <button onClick={() => onSetMobileHero(isMob ? null : url)} title="Hero Mobile 9:16"
          className={`w-6 h-6 text-[10px] flex items-center justify-center rounded-sm border transition-colors ${
            isMob ? 'bg-purple-600 border-purple-500' : 'bg-gray-900 border-gray-600 hover:border-purple-500'
          }`}>📱</button>
        <button onClick={() => onToggleSequenza(url)} title={inSeq ? 'Rimuovi da sequenza' : 'Aggiungi a sequenza'}
          className={`w-6 h-6 text-[10px] font-bold flex items-center justify-center rounded-sm border transition-colors ${
            inSeq ? 'bg-emerald-700 border-emerald-600 text-white' : 'bg-gray-900 border-gray-600 hover:border-emerald-600 text-gray-300'
          }`}>{inSeq ? '✓' : '+'}</button>
      </div>
    </div>
  )
}

function ImagePool({
  gelatoImages, uploadedImages, generatedImages,
  desktopHero, mobileHero, sequenza,
  onSetDesktopHero, onSetMobileHero, onToggleSequenza,
  productId, onUploaded, loading,
}) {
  const [uploading,   setUploading]   = useState(false)
  const [uploadErr,   setUploadErr]   = useState('')
  const [dragging,    setDragging]    = useState(false)
  const fileRef = useRef()

  const doUpload = useCallback(async files => {
    setUploading(true); setUploadErr('')
    // Hard timeout: if anything hangs (network, GitHub API, Vercel Blob retries),
    // abort after 90 s so the user always gets feedback.
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(new Error('Timeout — operazione troppo lenta (>90s)')), 90_000)
    try {
      for (const raw of Array.from(files)) {
        // Compress images > 3.2 MB in the browser so they fit in base64 JSON.
        // Videos cannot be compressed client-side → still use Vercel Blob.
        const file     = await compressImage(raw)
        const filename = sanitizeFilename(file.name)
        const isVideo  = /\.(mp4|mov|webm)$/i.test(filename)
        // Only videos need Vercel Blob now; all images go via base64.
        const useBlob  = isVideo

        if (useBlob) {
          const blob = await blobUpload(`${productId}/${filename}`, file, {
            access:          'public',
            handleUploadUrl: '/api/admin',
            abortSignal:     ctrl.signal,
          })
          await api('upload-image', { productId, filename, blobUrl: blob.url, isVideo }, ctrl.signal)
        } else {
          const dataUrl = await fileToBase64(file)
          await api('upload-image', { productId, filename, dataUrl }, ctrl.signal)
        }
      }
      onUploaded?.()
    } catch (e) {
      console.error('[ImagePool] upload error:', e)
      // ctrl.signal.reason is set when we call ctrl.abort(new Error(...))
      const msg = ctrl.signal.aborted
        ? (ctrl.signal.reason?.message || 'Timeout upload')
        : (e.message || String(e) || 'Errore upload sconosciuto')
      setUploadErr(msg)
    } finally {
      clearTimeout(timer)
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [productId, onUploaded])

  const thumbProps = { desktopHero, mobileHero, sequenza, onSetDesktopHero, onSetMobileHero, onToggleSequenza }

  const PoolSection = ({ label, images, emptyMsg }) => {
    if (!images?.length) return emptyMsg ? <p className="text-gray-700 text-[10px] italic">{emptyMsg}</p> : null
    return (
      <div>
        <p className="text-[10px] text-gray-600 uppercase tracking-wider font-mono mb-1.5">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {images.map(img => <PoolThumb key={img.url} img={img} {...thumbProps} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div>
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple className="hidden"
          onChange={e => doUpload(e.target.files)} />
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); doUpload(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed py-3 px-2 text-center cursor-pointer transition-colors ${
            dragging ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          {uploading
            ? <p className="text-indigo-400 text-xs animate-pulse">⏫ Caricamento…</p>
            : <p className="text-gray-500 text-xs">+ Importa immagine / video</p>}
        </div>
        {uploadErr && <p className="text-red-400 text-xs mt-1">⚠ {uploadErr}</p>}
      </div>

      {loading && <p className="text-gray-600 text-xs">Caricamento…</p>}

      <PoolSection label="Gelato · Default" images={gelatoImages} />
      <PoolSection label="Importate" images={uploadedImages} emptyMsg="Nessuna importata ancora" />
      <PoolSection label="Generate" images={generatedImages} emptyMsg="Nessuna generata ancora" />

      {!loading && !gelatoImages?.length && !uploadedImages?.length && !generatedImages?.length && (
        <p className="text-gray-600 text-xs">Nessuna immagine ancora.</p>
      )}

      <p className="text-[9px] text-gray-700 leading-relaxed border-t border-gray-800 pt-2">
        Hover → 🖥 Hero Desktop &nbsp;·&nbsp; 📱 Hero Mobile &nbsp;·&nbsp; + Sequenza
      </p>
    </div>
  )
}

// ── Media Panel — Hero + Sequenza (controlled) ───────────────────────────────
// Purely display: all state lives in AdminProductPage.
// Assignment happens from PoolThumb hover buttons; this panel shows the result
// and lets the user reorder the sequenza with ‹ › arrows.

function MediaPanel({ desktopHero, mobileHero, sequenza, allImages, onSetDesktopHero, onSetMobileHero, onReorderSequenza, onSave, saving, msg }) {
  const moveLeft  = i => { if (i === 0) return; const s = [...sequenza]; [s[i-1],s[i]]=[s[i],s[i-1]]; onReorderSequenza(s) }
  const moveRight = i => { if (i === sequenza.length-1) return; const s = [...sequenza]; [s[i],s[i+1]]=[s[i+1],s[i]]; onReorderSequenza(s) }
  const getImg    = url => allImages?.find(i => i.url === url) || { url, name: url.split('/').pop().split('?')[0] || 'image' }

  const HeroSlot = ({ url, label, aspect, color, onClear }) => {
    const isVideo = url && /\.(mp4|mov|webm)$/i.test(url)
    return (
      <div>
        <p className={`text-[10px] font-mono uppercase tracking-wider mb-2 ${color}`}>{label}</p>
        <div className={`w-full overflow-hidden border-2 flex items-center justify-center ${aspect} ${
          url
            ? (color === 'text-blue-400' ? 'border-blue-700' : 'border-purple-700')
            : 'border-dashed border-gray-700'
        }`}>
          {url ? (
            isVideo
              ? <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-1 text-gray-400">
                  <span className="text-2xl">🎬</span><span className="text-[10px]">video</span>
                </div>
              : <img src={url} alt="" className="w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.opacity = '0.3' }} />
          ) : (
            <span className="text-gray-600 text-xs">— non assegnato —</span>
          )}
        </div>
        {url && (
          <button onClick={onClear} className="text-[10px] text-gray-600 hover:text-red-400 mt-1 transition-colors">rimuovi</button>
        )}
      </div>
    )
  }

  return (
    <div className="border border-gray-800 bg-gray-950">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
        <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">🎬 Hero & Sequenza</h3>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
          <button onClick={onSave} disabled={saving} className={`${btnPrimary} text-xs py-1`}>
            {saving ? 'Salvataggio…' : '💾 Salva'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">

        {/* ── HERO ── */}
        <div>
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-3">Hero</p>
          <div className="grid grid-cols-2 gap-4">
            <HeroSlot url={desktopHero} label="🖥 Desktop · 16:9" aspect="aspect-video" color="text-blue-400"
              onClear={() => onSetDesktopHero(null)} />
            <HeroSlot url={mobileHero} label="📱 Mobile · 9:16" aspect="aspect-[9/16] max-h-48" color="text-purple-400"
              onClear={() => onSetMobileHero(null)} />
          </div>
        </div>

        {/* ── SEQUENZA ── */}
        <div>
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-3">
            Sequenza{sequenza.length > 0 ? ` · ${sequenza.length} immagini` : ''}
          </p>
          {sequenza.length === 0 ? (
            <p className="text-gray-600 text-xs py-2">Nessuna immagine — usa + nel pool per aggiungere.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {sequenza.map((url, i) => {
                const img       = getImg(url)
                const isDesktop = desktopHero === url
                const isMobile  = mobileHero  === url
                const isVideo   = /\.(mp4|mov|webm)$/i.test(url)
                return (
                  <div key={url} className="flex-shrink-0 relative group">
                    <div className={`w-20 h-20 border-2 overflow-hidden transition-all ${
                      isDesktop && isMobile ? 'border-indigo-500'
                        : isDesktop ? 'border-blue-600'
                        : isMobile  ? 'border-purple-600'
                        : 'border-gray-700'
                    }`}>
                      {isVideo
                        ? <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xl">🎬</div>
                        : <img src={url} alt={img.name} className="w-full h-full object-cover"
                            onError={e => { e.currentTarget.style.opacity = '0.3' }} />
                      }
                    </div>
                    {/* Position badge */}
                    <div className={`absolute -top-1.5 -left-1.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-sm ${
                      i === 0 ? 'bg-gray-500 text-white' : 'bg-gray-800 text-gray-400'
                    }`}>{i + 1}</div>
                    {/* Hero badges */}
                    {isDesktop && <div className="absolute top-0.5 right-0.5 bg-blue-600/90 text-white text-[8px] px-0.5 py-0.5 leading-none pointer-events-none">🖥</div>}
                    {isMobile  && <div className="absolute bottom-0.5 right-0.5 bg-purple-600/90 text-white text-[8px] px-0.5 py-0.5 leading-none pointer-events-none">📱</div>}
                    {/* Reorder controls */}
                    <div className="absolute bottom-0 inset-x-0 flex opacity-0 group-hover:opacity-100 transition-opacity bg-black/70">
                      <button onClick={() => moveLeft(i)} disabled={i === 0}
                        className="flex-1 text-white text-sm py-0.5 disabled:opacity-20 hover:bg-white/20 transition-colors" title="Sposta a sinistra">‹</button>
                      <button onClick={() => moveRight(i)} disabled={i === sequenza.length - 1}
                        className="flex-1 text-white text-sm py-0.5 disabled:opacity-20 hover:bg-white/20 transition-colors" title="Sposta a destra">›</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {sequenza.length > 0 && (
            <p className="text-gray-700 text-[10px] mt-2">Hover → ‹ › riordina · 🖥 hero desktop · 📱 hero mobile</p>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Remove Background ─────────────────────────────────────────────────────────

function RemoveBackground() {
  const [previewUrl,  setPreviewUrl]  = useState(null)  // source image preview
  const [inputUrl,    setInputUrl]    = useState('')
  const [useUrl,      setUseUrl]      = useState(false)
  const [processing,  setProcessing]  = useState(false)
  const [result,      setResult]      = useState(null)
  const [error,       setError]       = useState('')
  const [dragging,    setDragging]    = useState(false)
  const [downloaded,  setDownloaded]  = useState(false)
  const inputRef = useRef()
  const imageDataRef = useRef(null) // holds base64 data URL

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      imageDataRef.current = e.target.result
      setPreviewUrl(e.target.result)
      setResult(null); setError('')
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = e => {
    e.preventDefault(); setDragging(false)
    loadFile(e.dataTransfer.files?.[0])
  }

  const handleProcess = async () => {
    setProcessing(true); setError(''); setResult(null); setDownloaded(false)
    try {
      const payload = useUrl
        ? { imageUrl: inputUrl.trim() }
        : { imageData: imageDataRef.current }
      const data = await api('remove-background', payload)
      setResult(data.imageUrl)
      if (useUrl) setPreviewUrl(inputUrl.trim())
    } catch (e) {
      setError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!result) return
    const a = document.createElement('a')
    a.href = result
    a.download = 'no-background.png'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setDownloaded(true); setTimeout(() => setDownloaded(false), 2500)
  }

  const canProcess = !processing && (useUrl ? inputUrl.trim().length > 0 : !!previewUrl)

  return (
    <div className="border border-purple-900/50 bg-gray-950">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
        <h3 className="text-purple-400 text-xs font-mono uppercase tracking-widest">✂ Remove Background</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Source toggle */}
        <div className="flex gap-1">
          {[{ id: false, label: '📁 File' }, { id: true, label: '🔗 URL' }].map(opt => (
            <button key={String(opt.id)} onClick={() => { setUseUrl(opt.id); setError('') }}
              className={`px-3 py-1 text-xs border transition-colors ${
                useUrl === opt.id
                  ? 'border-purple-600 text-purple-300 bg-purple-900/20'
                  : 'border-gray-700 text-gray-500 hover:border-gray-500'
              }`}>{opt.label}</button>
          ))}
        </div>

        {useUrl ? (
          <input
            value={inputUrl}
            onChange={e => { setInputUrl(e.target.value); setResult(null); setError('') }}
            placeholder="https://…"
            className="w-full bg-gray-800 border border-gray-700 text-white text-xs px-3 py-2 focus:outline-none focus:border-purple-500 font-mono"
          />
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
              dragging ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <p className="text-gray-600 text-xs">Drop image or click to upload</p>
            <input ref={inputRef} type="file" accept="image/*" className="hidden"
              onChange={e => loadFile(e.target.files?.[0])} />
          </div>
        )}

        {/* Preview row: original + result */}
        {(previewUrl || result) && (
          <div className="grid grid-cols-2 gap-3">
            {previewUrl && (
              <div className="space-y-1">
                <p className="text-gray-600 text-xs text-center">Original</p>
                <div className="aspect-square bg-gray-900 border border-gray-800 overflow-hidden flex items-center justify-center">
                  <img src={previewUrl} alt="Original" className="max-w-full max-h-full object-contain"
                    onError={e => { e.currentTarget.style.display = 'none' }} />
                </div>
              </div>
            )}
            {result && (
              <div className="space-y-1">
                <p className="text-gray-600 text-xs text-center">Result</p>
                {/* Checkerboard bg to show transparency */}
                <div className="aspect-square border border-gray-800 overflow-hidden flex items-center justify-center"
                  style={{ background: 'repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 0 0 / 16px 16px' }}
                >
                  <img src={result} alt="No background" className="max-w-full max-h-full object-contain" />
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-xs">⚠ {error}</p>}

        <div className="flex items-center gap-2">
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className={`${btnPrimary} ${!canProcess ? 'opacity-40 cursor-not-allowed' : ''} flex items-center gap-2`}
          >
            {processing ? (
              <><span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />Processing…</>
            ) : '✂ Remove BG'}
          </button>
          {result && (
            <button onClick={handleDownload} className={btnGhost}>
              {downloaded ? '✓ Downloaded' : '⬇ Download PNG'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Collapsible ───────────────────────────────────────────────────────────────

function CopyBlock({ label, value, rows = 2 }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-gray-500 text-xs uppercase tracking-wider">{label}</p>
        <button onClick={copy} className={`${btnGhost} text-[10px] py-0.5 px-2`}>
          {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
      </div>
      <textarea
        readOnly
        value={value}
        rows={rows}
        className="w-full bg-gray-900/50 border border-gray-800 text-gray-400 text-xs px-3 py-2 resize-none focus:outline-none font-mono leading-relaxed"
      />
    </div>
  )
}

function Collapsible({ label, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors py-1 w-full text-left"
      >
        <span className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>▶</span>
        {label}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const knownCollections = [...new Set(allProducts.map(p => p.collection).filter(Boolean))]

export default function AdminProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Auth check
  const authed = sessionStorage.getItem('adminAuth') === '1'
  useEffect(() => {
    if (!authed) navigate('/admin', { replace: true })
  }, [authed])

  // Product state
  const [product, setProduct]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const isEditable = product?.adminManaged === true

  // Form state
  const [name, setName]             = useState('')
  const [price, setPrice]           = useState('')
  const [section, setSection]       = useState('objects')
  const [collection, setCollection] = useState('')
  const [movement, setMovement]     = useState('')
  const [description, setDescription] = useState('')
  const [altText, setAltText]       = useState('')
  const [tags, setTags]             = useState('')
  const [videoUrl, setVideoUrl]     = useState('')
  const [gelatoUid, setGelatoUid]   = useState('')
  const [featured, setFeatured]     = useState(false)

  // Status
  const [saving, setSaving]         = useState(false)
  const [saveMsg, setSaveMsg]       = useState('')
  const [saveErr, setSaveErr]       = useState('')
  const [deleting, setDeleting]     = useState(false)

  // AI generation
  const [generating, setGenerating]             = useState(false)
  const [genErr, setGenErr]                     = useState('')
  const [aiProvider, setAiProvider]             = useState('openai')
  // AI social/SEO output
  const [instagramCaption, setInstagramCaption] = useState('')
  const [pinterestCaption, setPinterestCaption] = useState('')
  const [hashtags, setHashtags]                 = useState('')
  const [primaryKeywords, setPrimaryKeywords]   = useState([])
  const [longTailKeywords, setLongTailKeywords] = useState([])

  // ── Lifted media state ────────────────────────────────────────────────────────
  const [desktopHero,    setDesktopHero]    = useState(null)
  const [mobileHero,     setMobileHero]     = useState(null)
  const [sequenza,       setSequenza]       = useState([])   // ordered array of URLs
  const [githubImages,   setGithubImages]   = useState([])   // [{ url, name, path }]
  const [loadingPool,    setLoadingPool]    = useState(false)
  const [poolRefreshKey, setPoolRefreshKey] = useState(0)
  const [savingMedia,    setSavingMedia]    = useState(false)
  const [mediaMsg,       setMediaMsg]       = useState('')

  // Load product
  useEffect(() => {
    const staticP = allProducts.find(p => p.id === id)

    const populate = p => {
      setProduct(p)
      setName(p.name || '')
      setPrice(p.price != null ? (p.price / 100).toString() : '')
      setSection(p.section || 'objects')
      setCollection(p.collection || '')
      setMovement(p.movement || '')
      setDescription(p.description || '')
      setAltText(p.altText || '')
      setTags(Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''))
      setVideoUrl(p.videoUrl || '')
      setGelatoUid(p.gelatoProductId || '')
      setFeatured(!!p.featured)
      // media
      setDesktopHero(p.image     || null)
      setMobileHero(p.heroImage  || null)
      setSequenza(Array.isArray(p.images) ? p.images : [])
    }

    if (staticP?.adminManaged) {
      // Fetch latest from GitHub
      api('read-product', { productId: id })
        .then(data => { populate(data.product); setLoading(false) })
        .catch(() => { populate(staticP); setLoading(false) })
    } else if (staticP) {
      populate(staticP)
      setLoading(false)
    } else {
      // Might be a new product not yet in build
      api('read-product', { productId: id })
        .then(data => { populate(data.product); setLoading(false) })
        .catch(() => { setNotFound(true); setLoading(false) })
    }
  }, [id])

  // ── Load GitHub images (re-runs when pool needs refresh) ────────────────────
  useEffect(() => {
    if (!id) return
    setLoadingPool(true)
    api('list-images', { productId: id })
      .then(data => setGithubImages(data.images || []))
      .catch(() => setGithubImages([]))
      .finally(() => setLoadingPool(false))
  }, [id, poolRefreshKey])

  // ── Computed image categories ─────────────────────────────────────────────
  const gelatoImages = useMemo(() => {
    const urls = new Set()
    const add  = u => u && !urls.has(u) && urls.add(u)
    ;(product?.images || []).forEach(u => { if (u && !u.includes('raw.githubusercontent.com')) add(u) })
    if (product?.image     && !product.image.includes('raw.githubusercontent.com'))     add(product.image)
    if (product?.heroImage && !product.heroImage.includes('raw.githubusercontent.com')) add(product.heroImage)
    return [...urls].map(url => ({ url, name: url.split('/').pop().split('?')[0] || 'image' }))
  }, [product])

  const uploadedImages  = useMemo(() => githubImages.filter(img => !img.path?.includes('/generated/')), [githubImages])
  const generatedImages = useMemo(() => githubImages.filter(img =>  img.path?.includes('/generated/')), [githubImages])
  const allPoolImages   = useMemo(() => [...gelatoImages, ...uploadedImages, ...generatedImages], [gelatoImages, uploadedImages, generatedImages])

  // ── Media handlers ────────────────────────────────────────────────────────
  const toggleSequenza = useCallback(url => {
    setSequenza(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url])
  }, [])

  const handleSaveMedia = useCallback(async () => {
    if (!id) return
    setSavingMedia(true); setMediaMsg('')
    try {
      await api('update-product-images', {
        productId: id,
        images:    sequenza,
        heroImage: mobileHero  || null,
        image:     desktopHero || sequenza[0] || null,
      })
      setProduct(prev => prev ? {
        ...prev,
        images:    sequenza,
        image:     desktopHero || sequenza[0] || prev.image,
        heroImage: mobileHero  || prev.heroImage,
      } : prev)
      setMediaMsg('✓ Salvato')
      setTimeout(() => setMediaMsg(''), 3000)
    } catch (e) {
      setMediaMsg('⚠ ' + e.message)
    } finally {
      setSavingMedia(false)
    }
  }, [id, sequenza, desktopHero, mobileHero])

  const videoInfo = parseVideoUrl(videoUrl)

  const generateWithAI = async () => {
    if (!name.trim()) return setGenErr('Enter a product name first')
    setGenerating(true); setGenErr('')
    try {
      const res = await fetch('/api/generate-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle: name.trim(), section, collection, movement, provider: aiProvider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      if (data.seoTitle)    setName(data.seoTitle)
      if (data.description) setDescription(data.description)
      if (data.altText)     setAltText(data.altText)
      if (data.tags?.length) setTags(data.tags.join(', '))
      if (data.instagramCaption) setInstagramCaption(data.instagramCaption)
      if (data.pinterestCaption) setPinterestCaption(data.pinterestCaption)
      if (data.hashtags)         setHashtags(data.hashtags)
      if (data.primaryKeywords?.length)  setPrimaryKeywords(data.primaryKeywords)
      if (data.longTailKeywords?.length) setLongTailKeywords(data.longTailKeywords)
    } catch (e) {
      setGenErr(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return setSaveErr('Name is required')
    if (!price)       return setSaveErr('Price is required')
    setSaving(true); setSaveErr(''); setSaveMsg('')
    try {
      const priceCents = Math.round(parseFloat(price) * 100)
      const updated = {
        ...product,
        name: name.trim(),
        price: priceCents,
        section,
        collection,
        subtitle: collection,
        movement,
        description: description.trim(),
        altText: altText.trim(),
        tags: tags.trim()
          ? tags.split(',').map(t => t.trim()).filter(Boolean)
          : product.tags || [],
        featured,
        gelatoProductId: gelatoUid.trim() || null,
        adminManaged: true,
        ...(videoUrl.trim() ? { videoUrl: videoUrl.trim() } : { videoUrl: undefined }),
      }
      // Clean undefined keys
      Object.keys(updated).forEach(k => updated[k] === undefined && delete updated[k])

      await api('save-product', { product: updated })
      setProduct(updated)
      setSaveMsg('✓ Saved — Vercel will redeploy automatically.')
      setTimeout(() => setSaveMsg(''), 4000)
    } catch (e) {
      setSaveErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api('delete-product', { productId: id })
      navigate('/admin', { replace: true })
    } catch (e) {
      setSaveErr(e.message)
      setDeleting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!authed) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading product…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Product <span className="font-mono text-white">{id}</span> not found.</p>
        <Link to="/admin" className={btnGhost}>← Back to Products</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Sticky header ── */}
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-13 flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              to="/admin"
              className="text-gray-500 hover:text-gray-300 text-xs flex items-center gap-1.5 flex-shrink-0 transition-colors"
            >
              ← Products
            </Link>
            <span className="text-gray-700 flex-shrink-0">·</span>
            <span className="font-mono text-xs text-gray-400 truncate">{id}</span>
            {isEditable
              ? <span className="bg-indigo-900/50 border border-indigo-800 text-indigo-300 text-xs px-2 py-0.5 flex-shrink-0">admin-managed</span>
              : <span className="bg-gray-800 text-gray-500 text-xs px-2 py-0.5 flex-shrink-0">hardcoded</span>
            }
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View on site */}
            <a
              href={`/product/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={btnGhost}
            >
              🌐 View on site
            </a>

            {isEditable && (
              <>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={btnDanger}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-5 py-2 text-sm font-semibold transition-colors cursor-pointer"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status bar */}
        {(saveMsg || saveErr) && (
          <div className={`px-6 py-2 text-xs ${saveMsg ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {saveMsg || saveErr}
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {!isEditable && (
          <div className="mb-6 bg-amber-900/20 border border-amber-800 px-4 py-3 text-amber-300 text-sm">
            This product is hardcoded in <span className="font-mono">src/data/products.js</span> and cannot be edited here. Fields are shown read-only.
          </div>
        )}

        <div className="grid lg:grid-cols-[340px_1fr] gap-8 items-start">

          {/* ── Left: image gallery ── */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <ImagePool
              gelatoImages={gelatoImages}
              uploadedImages={uploadedImages}
              generatedImages={generatedImages}
              desktopHero={desktopHero}
              mobileHero={mobileHero}
              sequenza={sequenza}
              onSetDesktopHero={setDesktopHero}
              onSetMobileHero={setMobileHero}
              onToggleSequenza={toggleSequenza}
              productId={id}
              onUploaded={() => setPoolRefreshKey(k => k + 1)}
              loading={loadingPool}
            />

            {/* Quick stats */}
            <div className="bg-gray-900 border border-gray-800 px-4 py-3 space-y-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Current price</span>
                <span className="text-gray-300">{product.price != null ? fmt(product.price) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Section</span>
                <span className="text-gray-300">{product.section || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Collection</span>
                <span className="text-gray-300">{product.collection || '—'}</span>
              </div>
              {product.gelatoProductId && (
                <div className="flex justify-between">
                  <span>Gelato UID</span>
                  <span className="text-gray-400 font-mono truncate max-w-[140px]">{product.gelatoProductId}</span>
                </div>
              )}
              {product.videoUrl && (
                <div className="flex justify-between">
                  <span>Video</span>
                  <span className="text-indigo-400">▶ linked</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: edit form ── */}
          <div className="space-y-8">

            {/* ── Hero & Sequenza ── */}
            {isEditable && (
              <MediaPanel
                desktopHero={desktopHero}
                mobileHero={mobileHero}
                sequenza={sequenza}
                allImages={allPoolImages}
                onSetDesktopHero={setDesktopHero}
                onSetMobileHero={setMobileHero}
                onReorderSequenza={setSequenza}
                onSave={handleSaveMedia}
                saving={savingMedia}
                msg={mediaMsg}
              />
            )}

            {/* ── Name + AI ── */}
            <Section title="Title">
              <Field label="Product name" hint={`id: ${id}`}>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!isEditable}
                  className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                />
              </Field>
              {isEditable && (
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <button
                    onClick={generateWithAI}
                    disabled={generating || !name.trim()}
                    className="flex items-center gap-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    {generating ? (
                      <><span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" /> Generating…</>
                    ) : (
                      <>✨ Regenerate with AI</>
                    )}
                  </button>
                  <select
                    value={aiProvider}
                    onChange={e => setAiProvider(e.target.value)}
                    disabled={generating}
                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1.5 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer disabled:opacity-40"
                    title="AI text provider"
                  >
                    <option value="openai">GPT-4o mini</option>
                    <option value="longcat-flash">Longcat Flash</option>
                    <option value="longcat-thinking">Longcat Thinking</option>
                  </select>
                  {genErr && <span className="text-red-400 text-xs">{genErr}</span>}
                  {!genErr && !generating && altText && description && (
                    <span className="text-violet-400 text-xs">✓ AI content applied</span>
                  )}
                </div>
              )}
            </Section>

            {/* ── Pricing & meta ── */}
            <Section title="Pricing & Categorisation">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Price (€)">
                  <input
                    type="number" min="0" step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    disabled={!isEditable}
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </Field>

                <Field label="Section">
                  <select
                    value={section}
                    onChange={e => setSection(e.target.value)}
                    disabled={!isEditable}
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  >
                    <option value="objects">objects</option>
                    <option value="art">art</option>
                  </select>
                </Field>

                <Field label="Collection">
                  <input
                    value={collection}
                    onChange={e => setCollection(e.target.value)}
                    disabled={!isEditable}
                    list="known-collections"
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                  <datalist id="known-collections">
                    {knownCollections.map(c => <option key={c} value={c} />)}
                  </datalist>
                </Field>

                <Field label="Movement / Style">
                  <input
                    value={movement}
                    onChange={e => setMovement(e.target.value)}
                    disabled={!isEditable}
                    className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                  />
                </Field>
              </div>

              {isEditable && (
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={e => setFeatured(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  <span className="text-gray-400 text-sm">Featured product (shown on homepage)</span>
                </label>
              )}
            </Section>

            {/* ── Description ── */}
            <Section title="Copy">
              <Field label="Description" hint="~150 words · shown in the About accordion on the product page">
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={!isEditable}
                  rows={6}
                  className={`${inputCls} resize-y${!isEditable ? ' opacity-50 cursor-not-allowed' : ''}`}
                />
              </Field>

              <Field label="Alt text" hint="1 sentence · shown to screen readers and used for SEO image indexing">
                <input
                  value={altText}
                  onChange={e => setAltText(e.target.value)}
                  disabled={!isEditable}
                  placeholder="Snorlax fan art t-shirt on white background…"
                  className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                />
              </Field>

              <Field
                label="Tags"
                hint={`${tags.split(',').filter(t => t.trim()).length}/13 tags · comma-separated · each max 20 chars`}
              >
                <textarea
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  disabled={!isEditable}
                  rows={3}
                  placeholder="snorlax shirt, pokemon gift, anime tee, …"
                  className={`${inputCls} resize-none${!isEditable ? ' opacity-50 cursor-not-allowed' : ''}`}
                />
              </Field>
            </Section>

            {/* ── Social & SEO ── */}
            {(instagramCaption || pinterestCaption || hashtags || primaryKeywords.length > 0) && (
              <Section title="Social & SEO">
                <div className="space-y-5">

                  {instagramCaption && (
                    <CopyBlock label="Instagram caption" value={instagramCaption} rows={3} />
                  )}
                  {pinterestCaption && (
                    <CopyBlock label="Pinterest caption" value={pinterestCaption} rows={3} />
                  )}
                  {hashtags && (
                    <CopyBlock label="Hashtags (30)" value={hashtags} rows={2} />
                  )}
                  {primaryKeywords.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Primary keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {primaryKeywords.map(kw => (
                          <span key={kw} className="border border-gray-700 text-gray-400 text-xs px-2 py-0.5">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {longTailKeywords.length > 0 && (
                    <Collapsible label={`${longTailKeywords.length} long-tail keywords`}>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {longTailKeywords.map(kw => (
                          <span key={kw} className="border border-gray-800 text-gray-500 text-xs px-2 py-0.5">{kw}</span>
                        ))}
                      </div>
                    </Collapsible>
                  )}

                </div>
              </Section>
            )}

            {/* ── Video ── */}
            <Section title="Video">
              <Field label="Video URL" hint="YouTube, Vimeo, or direct .mp4 — shown as hero on the product page">
                <input
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  disabled={!isEditable}
                  placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
                  className={inputCls + (!isEditable ? ' opacity-50 cursor-not-allowed' : '')}
                />
              </Field>

              {videoInfo?.type === 'youtube' && (
                <div className="relative w-48 mt-2">
                  <img
                    src={`https://img.youtube.com/vi/${videoInfo.id}/mqdefault.jpg`}
                    alt="Video thumbnail"
                    className="w-full border border-gray-700"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="text-white text-3xl">▶</span>
                  </div>
                </div>
              )}
              {videoInfo?.type === 'vimeo' && (
                <p className="text-gray-400 text-xs bg-gray-800 border border-gray-700 px-3 py-2 inline-block mt-2">
                  ▶ Vimeo · {videoInfo.id}
                </p>
              )}
              {videoInfo?.type === 'mp4' && (
                <p className="text-gray-400 text-xs bg-gray-800 border border-gray-700 px-3 py-2 inline-block mt-2">
                  MP4 video linked
                </p>
              )}
              {videoUrl && !videoInfo && (
                <p className="text-yellow-500 text-xs mt-1">⚠ URL not recognised as YouTube, Vimeo, or .mp4</p>
              )}
            </Section>

            {/* ── Gelato ── */}
            <Section title="Gelato">
              <Field label="Gelato Product UID" hint="Used to route orders to the correct Gelato product">
                <input
                  value={gelatoUid}
                  onChange={e => setGelatoUid(e.target.value.replace(/[^\x20-\x7E]/g, '').trim())}
                  disabled={!isEditable}
                  className={`${inputCls} font-mono text-xs${!isEditable ? ' opacity-50 cursor-not-allowed' : ''}`}
                />
              </Field>

              {/* Sizes read-only */}
              {product.sizes?.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Sizes</p>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map(s => (
                      <span key={s.id} className="border border-gray-700 text-gray-400 text-xs px-3 py-1">
                        {s.label} · {fmt(s.price)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Variants read-only */}
              {product.variants?.length > 0 && (
                <Collapsible label={`${product.variants.length} variant${product.variants.length !== 1 ? 's' : ''}`} defaultOpen={false}>
                  <div className="overflow-x-auto scrollbar-hide max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="text-gray-600 border-b border-gray-800">
                          <th className="pb-1.5 pr-3">Color</th>
                          <th className="pb-1.5 pr-3">Size</th>
                          <th className="pb-1.5">Gelato variant UID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.variants.map((v, i) => (
                          <tr key={i} className="border-b border-gray-800/40 text-gray-400">
                            <td className="py-1 pr-3">{v.color || v.id || '—'}</td>
                            <td className="py-1 pr-3">{v.size || '—'}</td>
                            <td className="py-1 font-mono text-gray-600 text-xs truncate max-w-xs">
                              {v.gelatoVariantId || v.uid || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Collapsible>
              )}
            </Section>

            {/* ── Save (bottom) ── */}
            {isEditable && (
              <div className="flex items-center gap-4 pt-4 border-t border-gray-800">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-8 py-3 text-sm font-semibold transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={btnDanger}
                >
                  {deleting ? 'Deleting…' : 'Delete Product'}
                </button>
                {saveMsg && <span className="text-green-400 text-sm">{saveMsg}</span>}
                {saveErr && <span className="text-red-400 text-sm">{saveErr}</span>}
              </div>
            )}

            {/* ── Generate Assets ── */}
            <GenerateAssetsTab
              productId={id}
              productName={name}
              productType={section === 'art' ? 'art print' : 'apparel/object'}
              primaryColor={product?.variants?.[0]?.color || ''}
              collection={collection}
              onAssetSaved={() => setPoolRefreshKey(k => k + 1)}
              preloadedImages={allPoolImages}
            />

            {/* ── Remove Background ── */}
            <RemoveBackground />

          </div>
        </div>
      </div>
    </div>
  )
}
