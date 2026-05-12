import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { generatePrompts as staticPrompts } from '@/data/generate-prompts'
import PromptCard from './PromptCard'
import {
  api, IMAGE_MODELS, VIDEO_MODELS, IMAGE_SIZES,
  subVars, toAbsoluteUrl, downloadAsset,
} from './constants'

// ── Sito section types ─────────────────────────────────────────────────────────
const SITO_SECTIONS = [
  { id: 'image', label: '📸 Immagini',  badge: '📸', isVideo: false },
  { id: 'hero',  label: '🦸 Hero',      badge: '🦸', isVideo: false },
  { id: 'video', label: '🎬 Video',     badge: '🎬', isVideo: true  },
]

// ── Review panel (right side) ─────────────────────────────────────────────────
function ReviewPanel({ results, productName, collection, productId, allImages }) {
  const [selected,       setSelected]       = useState(new Set())
  const [copy,           setCopy]           = useState(null)
  const [generatingCopy, setGeneratingCopy] = useState(false)
  const [copyError,      setCopyError]      = useState(null)
  const [copiedField,    setCopiedField]    = useState(null)
  const [reviewTab,      setReviewTab]      = useState('order')

  // ── Publish order state ──────────────────────────────────────────────────
  const [publishMsg,     setPublishMsg]     = useState('')
  const [publishing,     setPublishing]     = useState(false)

  // Build ordered list: Gelato defaults first, then generated images
  const doneEntries = Object.entries(results).filter(
    ([, r]) => r?.status === 'done' && (r.imageUrl || r.videoUrl)
  )

  // Initial publish order: Gelato defaults + generated (no duplication)
  const gelatoUrls = (allImages || []).map(img => ({ url: img.url || img.src, name: img.name || img.url?.split('/').pop(), _isGelato: true }))
  const generatedItems = doneEntries.map(([id, r]) => ({ url: r.imageUrl || r.videoUrl, name: id, _isVideo: !!r.videoUrl, _isGenerated: true }))

  const [order, setOrder] = useState(null) // null = auto-computed from current state

  // Auto-include newly generated items
  useEffect(() => {
    if (doneEntries.length === 0) return
    setSelected(prev => {
      const next = new Set(prev)
      doneEntries.forEach(([id]) => next.add(id))
      return next
    })
  }, [doneEntries.length]) // eslint-disable-line

  // Compute effective order
  const effectiveOrder = order ?? [...gelatoUrls, ...generatedItems]

  const moveUp   = (i) => { if (i === 0) return; const o = [...effectiveOrder]; [o[i-1],o[i]] = [o[i],o[i-1]]; setOrder(o) }
  const moveDown = (i) => { if (i === effectiveOrder.length-1) return; const o = [...effectiveOrder]; [o[i],o[i+1]] = [o[i+1],o[i]]; setOrder(o) }
  const setAsHero = (i) => { if (i === 0) return; const o = [...effectiveOrder]; const [item] = o.splice(i,1); o.unshift(item); setOrder(o) }
  const removeItem = (i) => { const o = [...effectiveOrder]; o.splice(i,1); setOrder(o) }

  const toggleSelect = (id) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const handleGenerateCopy = async () => {
    if (generatingCopy) return
    setGeneratingCopy(true); setCopyError(null); setCopy(null)
    try {
      const data = await api('generate-copy', {
        productName, collection, social: 'site', productType: 'site',
        selectedAssets: [...selected],
      })
      setCopy(data.copy)
    } catch (e) { setCopyError(e.message) }
    finally { setGeneratingCopy(false) }
  }

  const copyField = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(key)
      setTimeout(() => setCopiedField(null), 1500)
    })
  }

  const handlePublish = async () => {
    if (!productId || effectiveOrder.length === 0) return
    setPublishing(true); setPublishMsg('')
    try {
      const orderedUrls = effectiveOrder.map(item => item.url).filter(Boolean)
      await api('update-product-images', {
        productId,
        images:    orderedUrls,
        heroImage: orderedUrls[0] ?? null,
      })
      setPublishMsg('✓ Pubblicato su jayl.store')
      setTimeout(() => setPublishMsg(''), 4000)
    } catch (e) {
      setPublishMsg(`⚠ ${e.message}`)
      setTimeout(() => setPublishMsg(''), 5000)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="w-64 flex-shrink-0 border-l border-gray-800 sticky top-4 self-start">

      {/* tabs */}
      <div className="flex border-b border-gray-800">
        {[{ id: 'order', label: '🗂 Ordine' }, { id: 'copy', label: '✨ Copy' }].map(t => (
          <button key={t.id} onClick={() => setReviewTab(t.id)}
            className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
              reviewTab === t.id ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>{t.label}</button>
        ))}
      </div>

      <div className="p-3 space-y-3">

        {/* ── ORDER TAB ── */}
        {reviewTab === 'order' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Disposizione · pos 1 = Hero</p>
              {effectiveOrder.length > 0 && (
                <button onClick={() => setOrder(null)} className="text-gray-700 hover:text-gray-400 text-[10px] transition-colors">Reset</button>
              )}
            </div>

            {effectiveOrder.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-6">Genera asset o importa mockup Gelato</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin' }}>
                {effectiveOrder.map((item, i) => (
                  <div key={item.url || i} className={`flex items-center gap-1.5 bg-gray-900 border p-1.5 ${i === 0 ? 'border-yellow-700/60' : 'border-gray-800'}`}>
                    {/* Position badge */}
                    <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center text-[10px] font-bold rounded-sm ${
                      i === 0 ? 'bg-yellow-600 text-black' : 'bg-gray-800 text-gray-400'
                    }`}>{i + 1}</span>

                    {/* Thumbnail */}
                    {item._isVideo
                      ? <div className="w-8 h-8 flex-shrink-0 bg-gray-800 flex items-center justify-center text-sm">🎬</div>
                      : <img src={item.url} alt="" className="w-8 h-8 flex-shrink-0 object-cover border border-gray-700"
                          onError={e => { e.currentTarget.style.opacity = '0.3' }} />
                    }

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-400 text-[9px] truncate leading-tight">
                        {item._isGelato ? '🎨 Gelato' : item._isVideo ? '🎬 Video' : '✨ Gen'}
                      </p>
                      {i === 0 && <p className="text-yellow-500 text-[9px] font-semibold leading-tight">HERO</p>}
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      {i > 0 && (
                        <button onClick={() => setAsHero(i)} title="Set as Hero"
                          className="text-yellow-600 hover:text-yellow-400 text-[10px] px-1 leading-none transition-colors">★</button>
                      )}
                      <button onClick={() => moveUp(i)} disabled={i === 0}
                        className="text-gray-600 hover:text-gray-300 text-[10px] px-1 leading-none disabled:opacity-20 transition-colors">↑</button>
                      <button onClick={() => moveDown(i)} disabled={i === effectiveOrder.length - 1}
                        className="text-gray-600 hover:text-gray-300 text-[10px] px-1 leading-none disabled:opacity-20 transition-colors">↓</button>
                    </div>
                    <button onClick={() => removeItem(i)} title="Rimuovi da lista"
                      className="text-gray-700 hover:text-red-400 text-[10px] leading-none transition-colors flex-shrink-0 px-0.5">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Pubblica su jayl.store */}
            <button onClick={handlePublish}
              disabled={publishing || effectiveOrder.length === 0 || !productId}
              className={`w-full py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                publishing || effectiveOrder.length === 0 || !productId
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer'
              }`}>
              {publishing
                ? <><span className="animate-spin w-3 h-3 border border-emerald-300 border-t-transparent rounded-full inline-block" /> Pubblicando…</>
                : '🌐 Pubblica su jayl.store'
              }
            </button>
            {publishMsg && (
              <p className={`text-xs text-center ${publishMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{publishMsg}</p>
            )}
          </>
        )}

        {/* ── COPY TAB ── */}
        {reviewTab === 'copy' && (
          <>
            {doneEntries.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-6">Genera asset per la copy</p>
            ) : (
              <>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider">Seleziona per copy:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {doneEntries.map(([id, r]) => (
                    <div key={id} onClick={() => toggleSelect(id)}
                      className={`relative cursor-pointer border-2 transition-colors ${
                        selected.has(id) ? 'border-indigo-500' : 'border-gray-700 hover:border-gray-500'
                      }`}>
                      {r.imageUrl
                        ? <img src={r.imageUrl} alt="" className="w-full aspect-square object-cover" />
                        : <div className="w-full aspect-square bg-gray-900 flex items-center justify-center text-gray-500 text-lg">🎬</div>
                      }
                      {selected.has(id) && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-[8px]">✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button onClick={handleGenerateCopy}
                  disabled={generatingCopy || selected.size === 0}
                  className={`w-full py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    generatingCopy || selected.size === 0
                      ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  }`}>
                  {generatingCopy
                    ? <><span className="animate-spin w-3 h-3 border border-indigo-300 border-t-transparent rounded-full inline-block" /> Generando…</>
                    : `✨ Genera Copy (${selected.size})`}
                </button>

                {copyError && <p className="text-red-400 text-xs">{copyError}</p>}

                {copy && (
                  <div className="space-y-2">
                    {[
                      { key: 'seoTitle',       label: 'SEO Title'       },
                      { key: 'seoDescription', label: 'SEO Description' },
                      { key: 'altText',        label: 'Alt Text'        },
                      { key: 'etsyTitle',      label: 'Etsy Title'      },
                      { key: 'etsyTags',       label: 'Etsy Tags'       },
                    ].map(({ key, label }) => copy[key] ? (
                      <div key={key} className="bg-gray-900 border border-gray-800 p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-[10px] uppercase tracking-wider">{label}</span>
                          <button onClick={() => copyField(copy[key], key)}
                            className="text-gray-600 hover:text-gray-300 text-[10px] transition-colors">
                            {copiedField === key ? '✓' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-gray-300 text-[11px] leading-relaxed">{copy[key]}</p>
                      </div>
                    ) : null)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main SitoPanel ─────────────────────────────────────────────────────────────
export default function SitoPanel({
  productId, productName, productType, primaryColor, collection,
  allImages, onAssetSaved,
}) {
  const [rawPrompts,     setRawPrompts]     = useState(null)
  const [localPrompts,   setLocalPrompts]   = useState({})
  const [imageModel,     setImageModel]     = useState(IMAGE_MODELS[0].id)
  const [videoModel,     setVideoModel]     = useState(VIDEO_MODELS[0].id)
  const [imageSize,      setImageSize]      = useState('square_hd')
  const [videoDuration,  setVideoDuration]  = useState('5')
  const [results,        setResults]        = useState({})
  const [savingPrompts,  setSavingPrompts]  = useState({})
  const [savedMsgs,      setSavedMsgs]      = useState({})
  const [promptSettings, setPromptSettings] = useState({})
  const [selectedImages, setSelectedImages] = useState({})
  const [expandedSection, setExpandedSection] = useState('image')
  const pollTimers = useRef({})

  // ── Load prompts ─────────────────────────────────────────────────────────
  const initPrompts = useCallback((p) => {
    const v = { name: productName, type: productType, color: primaryColor, collection }
    setRawPrompts(p)
    const local    = {}
    const settings = {}
    // site prompts live under p.site or fall back to first social
    const siteData = p?.site || {}
    const allTemplates = [
      ...(siteData.image || []),
      ...(siteData.hero  || []),
      ...(siteData.video || []),
    ]
    for (const t of allTemplates) {
      local[t.id] = subVars(t.prompt, v)
      if (t.modelId || t.videoModelId || t.imageSize || t.referenceUrl || t.extraRefs) {
        settings[t.id] = {
          modelId:      t.modelId || t.videoModelId || null,
          imageSize:    t.imageSize    || null,
          referenceUrl: t.referenceUrl || null,
          extraRefs:    Array.isArray(t.extraRefs) ? t.extraRefs : [],
        }
      }
    }
    setLocalPrompts(local)
    setPromptSettings(settings)
  }, [productName, productType, primaryColor, collection]) // eslint-disable-line

  useEffect(() => {
    api('read-prompts', {})
      .then(data => initPrompts(data.prompts || { site: { image: [], hero: [], video: [] } }))
      .catch(() => initPrompts({ site: { image: [], hero: [], video: [] } }))
  }, [productId, initPrompts])

  useEffect(() => () => { Object.values(pollTimers.current).forEach(clearInterval) }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const patchResult = (id, patch) =>
    setResults(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))

  const getSelectedImage = (templateId) => {
    // Check for explicit user selection (null means "cleared" — fall through)
    if (selectedImages[templateId] !== undefined) return selectedImages[templateId] ?? null
    const savedRef = promptSettings[templateId]?.referenceUrl
    if (savedRef) return { url: savedRef, name: 'Pinned', _isPinned: true }
    return null  // no auto-select; generation falls back to allImages[0]
  }

  // ── Generation (multi-reference) ────────────────────────────────────────
  const handleGenerateImage = async (templateId) => {
    const prompt = localPrompts[templateId]
    if (!prompt?.trim()) return
    const ps         = promptSettings[templateId] || {}
    const modelToUse = ps.modelId   || imageModel
    const sizeToUse  = ps.imageSize || imageSize
    // Build multi-ref array: primary selected image + any extra refs.
    // If nothing is explicitly selected, fall back to the first product image.
    const primary   = getSelectedImage(templateId) ?? allImages[0] ?? null
    const extraRefs = ps.extraRefs || []
    const imageUrls = [primary, ...extraRefs]
      .filter(Boolean)
      .map(img => toAbsoluteUrl(img.url))
      .filter(Boolean)
    patchResult(templateId, { status: 'generating', error: null, imageUrl: null, saved: false })
    try {
      const res  = await fetch('/api/generate-mockup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: modelToUse, prompt: prompt.trim(), imageSize: sizeToUse,
          imageUrl: imageUrls[0] || undefined, imageUrls: imageUrls.length > 0 ? imageUrls : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      patchResult(templateId, { status: 'done', imageUrl: data.imageUrl })
    } catch (e) {
      patchResult(templateId, { status: 'error', error: e.message })
    }
  }

  const handleGenerateVideo = async (templateId) => {
    const prompt = localPrompts[templateId]
    if (!prompt?.trim()) return
    const ps         = promptSettings[templateId] || {}
    const modelToUse = ps.modelId || videoModel
    const imgObj     = getSelectedImage(templateId) ?? allImages[0] ?? null
    const imageUrl   = imgObj ? toAbsoluteUrl(imgObj.url) : undefined
    patchResult(templateId, { status: 'submitting', error: null, videoUrl: null, requestId: null, progress: 0, saved: false })
    try {
      const submitRes  = await fetch('/api/generate-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', modelId: modelToUse, prompt: prompt.trim(), duration: videoDuration, imageUrl }),
      })
      const submitData = await submitRes.json()
      if (!submitRes.ok) throw new Error(submitData.error || 'Submit failed')
      const requestId   = submitData.requestId
      const statusUrl   = submitData.statusUrl   || null  // authoritative URL from fal.ai
      const responseUrl = submitData.responseUrl || null
      if (!requestId) throw new Error('No requestId')
      patchResult(templateId, { status: 'processing', requestId, progress: 10 })

      const stopPoll = (id) => { clearInterval(pollTimers.current[id]); delete pollTimers.current[id] }

      const poll = async () => {
        try {
          const sRes  = await fetch('/api/generate-video', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status', modelId: modelToUse, requestId, statusUrl }),
          })
          const sData = await sRes.json()

          // ── If the status endpoint itself returned an error, surface it ──────
          if (!sRes.ok || sData.error) {
            stopPoll(requestId)
            patchResult(templateId, { status: 'error', error: sData.error || `Status check failed (HTTP ${sRes.status})` })
            return
          }

          const st = sData.status
          if (st === 'COMPLETED') {
            stopPoll(requestId)
            const rRes  = await fetch('/api/generate-video', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'result', modelId: modelToUse, requestId, responseUrl }),
            })
            const rData = await rRes.json()
            if (!rRes.ok) throw new Error(rData.error || 'Result fetch failed')
            if (!rData.videoUrl) throw new Error('No video URL in response')
            patchResult(templateId, { status: 'done', videoUrl: rData.videoUrl, progress: 100 })
          } else if (st === 'FAILED') {
            stopPoll(requestId)
            // Try to get error detail from logs
            const detail = sData.logs?.find(l => l.level === 'error')?.message || 'Generation failed on fal.ai'
            patchResult(templateId, { status: 'error', error: detail })
          } else {
            // IN_QUEUE → 20%, IN_PROGRESS → 60%, anything else stays at current
            const nextProgress = st === 'IN_PROGRESS' ? 60 : st === 'IN_QUEUE' ? 20 : null
            if (nextProgress !== null) patchResult(templateId, { progress: nextProgress })
          }
        } catch (e) {
          console.warn('[sito-video-poll]', e.message)
          // Don't stop the poll on transient network errors — it'll retry
        }
      }
      pollTimers.current[requestId] = setInterval(poll, 4000)
    } catch (e) {
      patchResult(templateId, { status: 'error', error: e.message })
    }
  }

  const handleSaveAsset = async (templateId, assetUrl, assetType) => {
    if (!productId || !assetUrl) return
    patchResult(templateId, { saving: true, error: null })
    try {
      const data = await api('import-generated-asset', { productId, assetUrl, assetType })
      patchResult(templateId, { saving: false, saved: true })
      if (assetType === 'image') onAssetSaved?.(data.path)
    } catch (e) {
      patchResult(templateId, { saving: false, error: e.message })
    }
  }

  const handleAddExtraRef = (templateId, ref) => {
    setPromptSettings(prev => {
      const ps   = prev[templateId] || {}
      const refs = ps.extraRefs || []
      if (refs.some(r => r.url === ref.url)) return prev
      return { ...prev, [templateId]: { ...ps, extraRefs: [...refs, ref] } }
    })
  }

  const handleRemoveExtraRef = (templateId, url) => {
    setPromptSettings(prev => {
      const ps = prev[templateId] || {}
      return { ...prev, [templateId]: { ...ps, extraRefs: (ps.extraRefs || []).filter(r => r.url !== url) } }
    })
  }

  const handleSavePrompt = async (templateId, sectionId) => {
    if (!rawPrompts) return
    setSavingPrompts(prev => ({ ...prev, [templateId]: true }))
    setSavedMsgs(prev => ({ ...prev, [templateId]: '' }))
    try {
      const ps     = promptSettings[templateId] || {}
      const selImg = selectedImages[templateId] || null
      const updatedSite = JSON.parse(JSON.stringify(rawPrompts?.site || { image: [], hero: [], video: [] }))
      const arr = updatedSite[sectionId]
      if (arr) {
        const idx = arr.findIndex(t => t.id === templateId)
        if (idx >= 0) {
          const isVid = sectionId === 'video'
          const extra = {}
          if (ps.modelId) extra[isVid ? 'videoModelId' : 'modelId'] = ps.modelId
          if (ps.imageSize && !isVid) extra.imageSize = ps.imageSize
          if (selImg?.url) extra.referenceUrl = selImg.url
          if (ps.extraRefs?.length) extra.extraRefs = ps.extraRefs
          arr[idx] = { ...arr[idx], prompt: localPrompts[templateId] ?? arr[idx].prompt, ...extra }
        }
      }
      const updated = { ...rawPrompts, site: updatedSite }
      await api('save-prompts', { prompts: updated })
      setRawPrompts(updated)
      setSavedMsgs(prev => ({ ...prev, [templateId]: '✓' }))
      setTimeout(() => setSavedMsgs(prev => ({ ...prev, [templateId]: '' })), 2000)
    } catch {
      setSavedMsgs(prev => ({ ...prev, [templateId]: '⚠' }))
    } finally {
      setSavingPrompts(prev => ({ ...prev, [templateId]: false }))
    }
  }

  const handleAddPrompt = async (sectionId) => {
    const id = `site-${sectionId}-custom-${Date.now()}`
    const updated = {
      ...rawPrompts,
      site: {
        ...(rawPrompts?.site || {}),
        [sectionId]: [...((rawPrompts?.site?.[sectionId]) || []), { id, name: 'New Prompt', prompt: '' }],
      },
    }
    try {
      await api('save-prompts', { prompts: updated })
      setRawPrompts(updated)
      setLocalPrompts(prev => ({ ...prev, [id]: '' }))
    } catch (e) { console.warn('add prompt failed', e.message) }
  }

  const handleDeletePrompt = async (templateId, sectionId) => {
    const updatedSite = JSON.parse(JSON.stringify(rawPrompts?.site || {}))
    if (updatedSite[sectionId]) {
      const idx = updatedSite[sectionId].findIndex(t => t.id === templateId)
      if (idx >= 0) updatedSite[sectionId].splice(idx, 1)
    }
    const updated = { ...rawPrompts, site: updatedSite }
    try {
      await api('save-prompts', { prompts: updated })
      setRawPrompts(updated)
    } catch (e) { console.warn('delete prompt failed', e.message) }
  }

  // ── Get templates per section ─────────────────────────────────────────────
  const getSectionTemplates = (sectionId) =>
    rawPrompts?.site?.[sectionId] || []

  const selectedVideoModel = VIDEO_MODELS.find(m => m.id === videoModel)

  return (
    <div className="flex items-start">

      {/* ── Left: prompt sections ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* Global settings bar */}
        <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/30 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-[10px] uppercase tracking-wider">📸 Model</span>
            <select value={imageModel} onChange={e => setImageModel(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 focus:outline-none">
              {IMAGE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.badge ? `${m.badge} ` : ''}{m.label} — {m.cost}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            {IMAGE_SIZES.map(s => (
              <button key={s.id} onClick={() => setImageSize(s.id)} title={s.desc}
                className={`px-2 py-0.5 text-xs border transition-colors ${
                  imageSize === s.id ? 'border-blue-500 text-blue-300' : 'border-gray-700 text-gray-600 hover:border-gray-500'
                }`}>{s.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-[10px] uppercase tracking-wider">🎬 Model</span>
            <select value={videoModel} onChange={e => setVideoModel(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 focus:outline-none">
              {VIDEO_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.badge ? `${m.badge} ` : ''}{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="range" min={3} max={15} step={1}
              value={parseInt(videoDuration, 10) || 5}
              onChange={e => setVideoDuration(e.target.value)}
              className="w-20 accent-blue-500 cursor-pointer" />
            <span className="text-blue-300 text-xs font-mono w-8">{videoDuration}s</span>
            <span className="text-gray-600 text-xs">
              ≈${((selectedVideoModel?.secRate ?? 0) * parseFloat(videoDuration)).toFixed(3)}
            </span>
          </div>
        </div>

        {allImages.length === 0 && (
          <div className="mx-4 mt-3 bg-yellow-900/20 border border-yellow-800/50 px-3 py-2 text-yellow-400 text-xs">
            ⚠ Nessuna immagine di riferimento. Importa i mockup Gelato prima.
          </div>
        )}

        {/* 3 accordion sections: Image / Hero / Video */}
        {SITO_SECTIONS.map(section => {
          const templates  = getSectionTemplates(section.id)
          const isExpanded = expandedSection === section.id

          return (
            <div key={section.id} className="border-b border-gray-800">
              {/* Section header — clickable to expand */}
              <button
                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-900/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white text-xs font-semibold">{section.label}</span>
                  <span className="text-gray-600 text-xs">{templates.length} prompt{templates.length !== 1 ? 's' : ''}</span>
                </div>
                <span className={`text-gray-500 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-4">
                  {templates.length === 0 && (
                    <p className="text-gray-600 text-xs py-2">Nessun prompt ancora. Clicca + per aggiungerne uno.</p>
                  )}

                  {templates.map(t => (
                    <PromptCard
                      key={t.id}
                      template={t}
                      productId={productId}
                      isVideo={section.isVideo}
                      promptText={localPrompts[t.id] ?? ''}
                      onPromptChange={val => setLocalPrompts(prev => ({ ...prev, [t.id]: val }))}
                      result={results[t.id]}
                      onGenerate={() => section.isVideo ? handleGenerateVideo(t.id) : handleGenerateImage(t.id)}
                      onSave={(url, type) => handleSaveAsset(t.id, url, type)}
                      onSavePrompt={() => handleSavePrompt(t.id, section.id)}
                      onDelete={() => handleDeletePrompt(t.id, section.id)}
                      savingPrompt={savingPrompts[t.id]}
                      savedPromptMsg={savedMsgs[t.id]}
                      images={allImages}
                      extraRefs={promptSettings[t.id]?.extraRefs || []}
                      onAddExtraRef={ref => handleAddExtraRef(t.id, ref)}
                      onRemoveExtraRef={url => handleRemoveExtraRef(t.id, url)}
                      selectedImage={getSelectedImage(t.id)}
                      onSelectImage={img => setSelectedImages(prev => ({ ...prev, [t.id]: img }))}
                      activeModel={promptSettings[t.id]?.modelId || null}
                      activeSize={promptSettings[t.id]?.imageSize || null}
                      onModelChange={val => setPromptSettings(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), modelId: val } }))}
                      onSizeChange={val => setPromptSettings(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), imageSize: val } }))}
                      models={section.isVideo ? VIDEO_MODELS : IMAGE_MODELS}
                      imageSizes={IMAGE_SIZES}
                    />
                  ))}

                  {/* Add prompt */}
                  <button onClick={() => handleAddPrompt(section.id)}
                    className="w-full py-2 text-xs border border-dashed border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1">
                    + Aggiungi prompt {section.label}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Right: Review + Publish ───────────────────────────────────── */}
      <ReviewPanel
        results={results}
        productName={productName}
        collection={collection}
        productId={productId}
        allImages={allImages}
      />

    </div>
  )
}
