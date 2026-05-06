import { useState, useEffect, useRef, useCallback } from 'react'
import { generatePrompts as defaultPromptsStatic } from '@/data/generate-prompts'

const ADMIN_PASSWORD = 'jaylpelle'

async function api(action, data) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: ADMIN_PASSWORD, ...data }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Request failed')
  return json
}

const btnPrimary = 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer'
const btnGhost   = 'border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 px-3 py-1.5 text-xs transition-colors cursor-pointer'

// ── Model lists ───────────────────────────────────────────────────────────────

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

const IMAGE_SIZES = [
  { id: 'square_hd',      label: '1:1',  desc: '1024×1024' },
  { id: 'portrait_16_9',  label: '9:16', desc: '576×1024'  },
  { id: 'landscape_16_9', label: '16:9', desc: '1024×576'  },
  { id: 'portrait_4_3',   label: '3:4',  desc: '768×1024'  },
  { id: 'landscape_4_3',  label: '4:3',  desc: '1024×768'  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const subVars = (tmpl, vars) =>
  (tmpl || '')
    .replace(/\{PRODUCT_NAME\}/g,  vars.name       || 'this product')
    .replace(/\{PRODUCT_TYPE\}/g,  vars.type       || 'product')
    .replace(/\{COLOR\}/g,         vars.color      || 'default color')
    .replace(/\{COLLECTION\}/g,    vars.collection || '')

// Convert relative /images/... path to absolute URL for fal.ai (passes through if already absolute)
const toAbsoluteUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${window.location.origin}${url}`
}

async function downloadAsset(url, filename) {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  } catch {
    window.open(url, '_blank')
  }
}

// ── PromptCard (module-level — never define inside another component) ─────────
// images: [{ url, name }] — all available reference images (absolute or relative)
// selectedImage: { url, name } | null
// onSelectImage: (img) => void

function PromptCard({
  template, isVideo, promptText, onPromptChange,
  result, onGenerate, onSave, onSavePrompt, savingPrompt, savedPromptMsg,
  images, selectedImage, onSelectImage,
  activeModel, activeSize, onModelChange, onSizeChange,
  models, imageSizes,
}) {
  const r    = result || {}
  const busy = r.status === 'generating' || r.status === 'submitting' || r.status === 'processing'
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="bg-gray-900 border border-gray-800 p-4 space-y-3">

      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider">{template.name}</p>
        {savedPromptMsg && (
          <span className={`text-xs flex-shrink-0 ${savedPromptMsg.startsWith('✓') ? 'text-green-400' : 'text-yellow-400'}`}>
            {savedPromptMsg}
          </span>
        )}
      </div>

      {/* Per-prompt settings toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSettingsOpen(o => !o)}
          className="text-gray-600 hover:text-gray-400 text-xs flex items-center gap-1 transition-colors"
        >
          ⚙ <span>{settingsOpen ? 'Hide settings' : 'Settings'}</span>
          {(activeModel || activeSize) && <span className="text-indigo-500">●</span>}
        </button>
        {activeModel && (
          <span className="text-indigo-400/60 text-xs truncate max-w-40">
            {models.find(m => m.id === activeModel)?.label}
          </span>
        )}
      </div>

      {/* Per-prompt settings panel */}
      {settingsOpen && (
        <div className="bg-gray-950 border border-gray-700/50 p-3 space-y-2.5">
          {/* Model */}
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-xs w-12 flex-shrink-0">Model</span>
            <select
              value={activeModel || ''}
              onChange={e => onModelChange(e.target.value || null)}
              className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 flex-1 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Global default —</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.badge ? `${m.badge} ` : ''}{m.label}
                </option>
              ))}
            </select>
          </div>
          {/* Size (image only) */}
          {!isVideo && imageSizes && (
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-xs w-12 flex-shrink-0">Size</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => onSizeChange(null)}
                  className={`px-2 py-0.5 text-xs border transition-colors ${
                    !activeSize ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-gray-700 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  default
                </button>
                {imageSizes.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onSizeChange(s.id)}
                    title={s.desc}
                    className={`px-2 py-0.5 text-xs border transition-colors ${
                      activeSize === s.id
                        ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30'
                        : 'border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
                {activeSize && (
                  <span className="text-gray-600 text-xs self-center ml-1">
                    {imageSizes.find(s => s.id === activeSize)?.desc}
                  </span>
                )}
              </div>
            </div>
          )}
          {/* Reference pin info */}
          <p className="text-gray-700 text-xs">
            💾 Select a reference image below, then <strong className="text-gray-500">Save prompt</strong> to pin it to this preset.
          </p>
        </div>
      )}

      {/* Per-prompt image selector (compact horizontal strip) */}
      {images.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'thin' }}>
          {images.map((img, i) => {
            const isSelected = selectedImage
              ? selectedImage.url === img.url
              : i === 0   // first image is default
            return (
              <button
                key={img.url || i}
                onClick={() => onSelectImage(img)}
                title={img.name}
                className={`flex-shrink-0 w-12 h-12 border-2 overflow-hidden transition-all ${
                  isSelected
                    ? 'border-indigo-500 ring-1 ring-indigo-500/40'
                    : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                <img
                  src={toAbsoluteUrl(img.url)}
                  alt={img.name}
                  className="w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.opacity = '0.3' }}
                />
              </button>
            )
          })}
        </div>
      )}

      {/* Editable textarea */}
      <textarea
        value={promptText ?? ''}
        onChange={e => onPromptChange(e.target.value)}
        rows={3}
        className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs px-3 py-2 resize-none focus:outline-none focus:border-indigo-500 transition-colors font-mono"
      />

      {/* Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onGenerate}
          disabled={busy}
          className={`${btnPrimary} text-xs py-1.5 flex items-center gap-2`}
        >
          {busy ? (
            <>
              <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full flex-shrink-0" />
              {r.status === 'processing' ? `${r.progress ?? 0}%…` : r.status === 'submitting' ? 'Submitting…' : 'Generating…'}
            </>
          ) : (
            isVideo ? '🎬 Generate' : '🖼 Generate'
          )}
        </button>
        <button
          onClick={onSavePrompt}
          disabled={savingPrompt}
          className={`${btnGhost} text-xs py-1`}
          title="Save as default template"
        >
          {savingPrompt ? '…' : '💾 Save prompt'}
        </button>
      </div>

      {/* Video progress bar */}
      {isVideo && (r.status === 'submitting' || r.status === 'processing') && (
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${r.progress ?? 5}%` }}
          />
        </div>
      )}

      {/* Error */}
      {r.status === 'error' && r.error && (
        <p className="text-red-400 text-xs">⚠ {r.error}</p>
      )}

      {/* Image result */}
      {!isVideo && r.imageUrl && (
        <div className="space-y-2">
          <img
            src={r.imageUrl}
            alt="Generated"
            className="w-full border border-gray-700"
            style={{ maxHeight: 280, objectFit: 'contain', background: '#111' }}
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onSave(r.imageUrl, 'image')}
              disabled={r.saving || r.saved}
              className={`${btnPrimary} text-xs py-1 px-3`}
            >
              {r.saving ? 'Saving…' : r.saved ? '✓ Saved' : '💾 Save to Product'}
            </button>
            <button onClick={() => downloadAsset(r.imageUrl, `${template.id}.jpg`)} className={`${btnGhost} text-xs py-1`}>
              ⬇ Download
            </button>
            <button onClick={onGenerate} disabled={busy} className={`${btnGhost} text-xs py-1`}>↻ Regen</button>
          </div>
        </div>
      )}

      {/* Video result */}
      {isVideo && r.videoUrl && (
        <div className="space-y-2">
          <video src={r.videoUrl} controls className="w-full border border-gray-700" style={{ maxHeight: 240 }} />
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => onSave(r.videoUrl, 'video')}
              disabled={r.saving || r.saved}
              className={`${btnPrimary} text-xs py-1 px-3`}
            >
              {r.saving ? 'Saving…' : r.saved ? '✓ Saved' : '💾 Save to Product'}
            </button>
            <button onClick={() => downloadAsset(r.videoUrl, `${template.id}.mp4`)} className={`${btnGhost} text-xs py-1`}>
              ⬇ Download
            </button>
            <button onClick={onGenerate} disabled={busy} className={`${btnGhost} text-xs py-1`}>↻ Regen</button>
            <a href={r.videoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-xs underline">
              Open ↗
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── GenerateAssetsTab ─────────────────────────────────────────────────────────
// preloadedImages: [{ url, name }] — Gelato CDN images passed from parent (for Add Product flow)
//                                    Used when productImages haven't been fetched yet (e.g. new product)

export default function GenerateAssetsTab({ productId, productName, productType, primaryColor, collection, onAssetSaved, preloadedImages, personas, instagramCaption, pinterestCaption, hashtags }) {
  const [activeTab,       setActiveTab]       = useState('mockup')
  const [rawPrompts,      setRawPrompts]      = useState(null)
  const [localPrompts,    setLocalPrompts]    = useState({})
  const [imageModel,      setImageModel]      = useState(IMAGE_MODELS[0].id)
  const [videoModel,      setVideoModel]      = useState(VIDEO_MODELS[0].id)
  const [imageSize,       setImageSize]       = useState('square_hd')
  const [videoDuration,   setVideoDuration]   = useState('5')
  const [results,         setResults]         = useState({})
  const [savingPrompts,   setSavingPrompts]   = useState({})
  const [savedPromptMsgs, setSavedPromptMsgs] = useState({})
  const [generatingAll,   setGeneratingAll]   = useState(false)
  const [allProgress,     setAllProgress]     = useState({ done: 0, total: 0 })
  const [selectedPersonaId, setSelectedPersonaId] = useState('')
  const [publishCaption,    setPublishCaption]    = useState('')
  const [publishCopied,     setPublishCopied]     = useState('')

  // ── Image sources ──────────────────────────────────────────────────────────
  // productImages: fetched from GitHub (saved images for this product)
  // allImages: productImages if available, otherwise preloadedImages (Gelato CDN)
  const [productImages, setProductImages] = useState([])  // [{ name, path, sha, url }]

  // Per-template image selection: { [templateId]: { url, name } }
  const [selectedImages, setSelectedImages] = useState({})

  // Per-prompt overrides: { [templateId]: { modelId?, imageSize?, referenceUrl? } }
  const [promptSettings, setPromptSettings] = useState({})

  const pollTimers = useRef({})

  // Merge sources: prefer fetched product images, fall back to Gelato preloads
  const normalizedPreloaded = (preloadedImages || []).map(img => ({
    url:  img.url,
    name: img.name || img.url.split('/').pop() || 'image',
  }))
  const allImages = productImages.length > 0 ? productImages : normalizedPreloaded

  // ── Selected persona context ───────────────────────────────────────────────
  const selectedPersona = (personas || []).find(p => p.id === selectedPersonaId) ?? null
  const personaImages   = selectedPersona
    ? (selectedPersona.referenceImages || []).map((url, i) => ({
        url,
        name: `${selectedPersona.name} ref ${i + 1}`,
        _isPersonaRef: true,
      }))
    : []

  // Sync default publish caption when persona or product captions change
  useEffect(() => {
    if (!selectedPersona) return
    const base = instagramCaption || `Just dropped: ${productName}. 🖤 Grab it now. ${hashtags ? '\n' + hashtags : ''}`
    setPublishCaption(base)
  }, [selectedPersonaId, instagramCaption]) // eslint-disable-line

  // ── Load product images on mount ───────────────────────────────────────────

  useEffect(() => {
    if (!productId) return
    api('list-images', { productId })
      .then(data => {
        const imgs = (data.images || []).filter(i => !/generated\//.test(i.path))
        setProductImages(imgs)
      })
      .catch(() => {})
  }, [productId])

  // ── Prompts ────────────────────────────────────────────────────────────────

  const initPrompts = useCallback((p) => {
    const v = { name: productName, type: productType, color: primaryColor, collection }
    setRawPrompts(p)
    const local    = {}
    const settings = {}
    for (const t of [...(p.mockup || []), ...(p.video || [])]) {
      local[t.id] = subVars(t.prompt, v)
      if (t.modelId || t.videoModelId || t.imageSize || t.referenceUrl) {
        settings[t.id] = {
          modelId:      t.modelId || t.videoModelId || null,
          imageSize:    t.imageSize    || null,
          referenceUrl: t.referenceUrl || null,
        }
      }
    }
    setLocalPrompts(local)
    setPromptSettings(settings)
  }, [productName, productType, primaryColor, collection]) // eslint-disable-line

  useEffect(() => {
    api('read-prompts', {})
      .then(data => initPrompts(data.prompts || defaultPromptsStatic))
      .catch(() => initPrompts(defaultPromptsStatic))
  }, [productId, initPrompts])

  useEffect(() => () => { Object.values(pollTimers.current).forEach(clearInterval) }, [])

  const patchResult = (id, patch) =>
    setResults(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))

  // ── Helper: get selected image for a template (defaults to first image) ────

  const getSelectedImage = (templateId) => {
    if (selectedImages[templateId]) return selectedImages[templateId]
    const savedRef = promptSettings[templateId]?.referenceUrl
    if (savedRef) return { url: savedRef, name: 'Pinned reference', _isPinned: true }
    return allImages[0] ?? null
  }

  // ── Image generation (img-to-img) ─────────────────────────────────────────

  const buildPrompt = (basePrompt) => {
    if (!selectedPersona) return basePrompt.trim()
    const ctx = selectedPersona.promptContext || selectedPersona.aesthetic || ''
    return ctx ? `${basePrompt.trim()} — ${ctx}` : basePrompt.trim()
  }

  const handleGenerateImage = async (templateId) => {
    const prompt = localPrompts[templateId]
    if (!prompt?.trim()) return
    const ps        = promptSettings[templateId] || {}
    const modelToUse = ps.modelId  || imageModel
    const sizeToUse  = ps.imageSize || imageSize
    const imgObj     = getSelectedImage(templateId)
    const imageUrl   = imgObj ? toAbsoluteUrl(imgObj.url) : undefined
    patchResult(templateId, { status: 'generating', error: null, imageUrl: null, saved: false })
    try {
      const res = await fetch('/api/generate-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: modelToUse, prompt: buildPrompt(prompt), imageSize: sizeToUse, imageUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      patchResult(templateId, { status: 'done', imageUrl: data.imageUrl })
    } catch (e) {
      patchResult(templateId, { status: 'error', error: e.message })
    }
  }

  // ── Video generation (img-to-video) ───────────────────────────────────────

  const handleGenerateVideo = async (templateId) => {
    const prompt = localPrompts[templateId]
    if (!prompt?.trim()) return
    const ps           = promptSettings[templateId] || {}
    const modelToUse   = ps.modelId || videoModel
    const imgObj       = getSelectedImage(templateId)
    const imageUrl     = imgObj ? toAbsoluteUrl(imgObj.url) : undefined

    patchResult(templateId, { status: 'submitting', error: null, videoUrl: null, requestId: null, progress: 0, saved: false })
    try {
      const submitRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', modelId: modelToUse, prompt: buildPrompt(prompt), duration: videoDuration, imageUrl }),
      })
      const submitData = await submitRes.json()
      if (!submitRes.ok) throw new Error(submitData.error || 'Submit failed')
      const requestId = submitData.requestId
      if (!requestId) throw new Error('No requestId in response')
      patchResult(templateId, { status: 'processing', requestId, progress: 10 })

      const poll = async () => {
        try {
          const sRes  = await fetch('/api/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status', modelId: modelToUse, requestId }),
          })
          const sData = await sRes.json()
          const st    = sData.status
          if (st === 'COMPLETED') {
            clearInterval(pollTimers.current[requestId])
            delete pollTimers.current[requestId]
            const rRes  = await fetch('/api/generate-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'result', modelId: modelToUse, requestId }),
            })
            const rData = await rRes.json()
            if (!rRes.ok) throw new Error(rData.error)
            patchResult(templateId, { status: 'done', videoUrl: rData.videoUrl, progress: 100 })
          } else if (st === 'FAILED') {
            clearInterval(pollTimers.current[requestId])
            delete pollTimers.current[requestId]
            patchResult(templateId, { status: 'error', error: 'Generation failed on fal.ai' })
          } else {
            patchResult(templateId, { progress: st === 'IN_PROGRESS' ? 60 : 20 })
          }
        } catch (e) {
          console.warn('[video-poll]', e.message)
        }
      }
      pollTimers.current[requestId] = setInterval(poll, 3000)
    } catch (e) {
      patchResult(templateId, { status: 'error', error: e.message })
    }
  }

  // ── Generate All — runs every template in sequence ───────────────────────────

  const handleGenerateAll = async (templates, isVideo) => {
    if (generatingAll || templates.length === 0) return
    setGeneratingAll(true)
    setAllProgress({ done: 0, total: templates.length })
    for (let i = 0; i < templates.length; i++) {
      const t   = templates[i]
      const r   = results[t.id]
      const busy = r?.status === 'generating' || r?.status === 'submitting' || r?.status === 'processing'
      if (!busy) {
        if (isVideo) await handleGenerateVideo(t.id)
        else         await handleGenerateImage(t.id)
      }
      setAllProgress({ done: i + 1, total: templates.length })
    }
    setGeneratingAll(false)
  }

  // ── Save asset to product ────────────────────────────────────────────────────

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

  // ── Save single prompt template ──────────────────────────────────────────────

  const handleSavePrompt = async (templateId, isVideoPrompt) => {
    if (!rawPrompts) return
    setSavingPrompts(prev => ({ ...prev, [templateId]: true }))
    setSavedPromptMsgs(prev => ({ ...prev, [templateId]: '' }))
    try {
      const category   = isVideoPrompt ? 'video' : 'mockup'
      const ps         = promptSettings[templateId] || {}
      const selImg     = selectedImages[templateId] || null
      const updated = {
        ...rawPrompts,
        [category]: (rawPrompts[category] || []).map(t => {
          if (t.id !== templateId) return t
          const extra = {}
          if (ps.modelId)            extra[isVideoPrompt ? 'videoModelId' : 'modelId'] = ps.modelId
          if (ps.imageSize && !isVideoPrompt) extra.imageSize = ps.imageSize
          if (selImg?.url)           extra.referenceUrl = selImg.url
          return { ...t, prompt: localPrompts[templateId] ?? t.prompt, ...extra }
        }),
      }
      await api('save-prompts', { prompts: updated })
      setRawPrompts(updated)
      // Sync promptSettings with what we just saved
      setPromptSettings(prev => ({
        ...prev,
        [templateId]: {
          ...(prev[templateId] || {}),
          ...(ps.modelId ? { modelId: ps.modelId } : {}),
          ...(ps.imageSize ? { imageSize: ps.imageSize } : {}),
          ...(selImg?.url ? { referenceUrl: selImg.url } : {}),
        },
      }))
      setSavedPromptMsgs(prev => ({ ...prev, [templateId]: '✓ Saved' }))
      setTimeout(() => setSavedPromptMsgs(prev => ({ ...prev, [templateId]: '' })), 2500)
    } catch (e) {
      setSavedPromptMsgs(prev => ({ ...prev, [templateId]: '⚠ Error' }))
    } finally {
      setSavingPrompts(prev => ({ ...prev, [templateId]: false }))
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const prompts          = rawPrompts || defaultPromptsStatic
  const currentTemplates = activeTab === 'mockup' ? (prompts.mockup || []) : (prompts.video || [])
  const selectedVideoModel = VIDEO_MODELS.find(m => m.id === videoModel)

  return (
    <div className="border border-indigo-900/50 bg-gray-950">

      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800">
        <h3 className="text-indigo-400 text-xs font-mono uppercase tracking-widest">✨ Generate Assets</h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {[
          { id: 'mockup',  label: '🖼 Mockup' },
          { id: 'video',   label: '🎬 Video'  },
          { id: 'publish', label: '📱 Publish' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">

        {/* Persona selector */}
        {personas?.length > 0 && (
          <div className="bg-indigo-950/40 border border-indigo-900/50 p-3 space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-indigo-400 text-xs w-16 flex-shrink-0 font-medium">Persona</label>
              <select
                value={selectedPersonaId}
                onChange={e => setSelectedPersonaId(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-xs px-3 py-1.5 focus:outline-none focus:border-indigo-500 flex-1 min-w-0"
              >
                <option value="">— None (generic) —</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.handle}</option>
                ))}
              </select>
            </div>
            {selectedPersona && (
              <div className="flex items-start gap-3 pt-1">
                {selectedPersona.referenceImages?.[0] && (
                  <img src={selectedPersona.referenceImages[0]} alt={selectedPersona.name}
                    className="w-8 h-8 rounded-full object-cover border border-indigo-800 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-indigo-200 text-xs font-medium">{selectedPersona.name} · {selectedPersona.handle}</p>
                  <p className="text-indigo-400/70 text-xs line-clamp-1 mt-0.5">{selectedPersona.promptContext || selectedPersona.aesthetic}</p>
                </div>
              </div>
            )}
            {selectedPersona && personaImages.length > 0 && (
              <div>
                <p className="text-indigo-400/60 text-xs mb-1.5">Persona references (select as img2img source below):</p>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'thin' }}>
                  {personaImages.map((img, i) => (
                    <button
                      key={img.url}
                      onClick={() => {
                        const currentTemplates2 = activeTab === 'mockup'
                          ? (rawPrompts || defaultPromptsStatic).mockup || []
                          : (rawPrompts || defaultPromptsStatic).video  || []
                        const newSel = {}
                        for (const t of currentTemplates2) newSel[t.id] = img
                        setSelectedImages(prev => ({ ...prev, ...newSel }))
                      }}
                      title={`Set ${img.name} as reference for all prompts`}
                      className="flex-shrink-0 w-12 h-12 border-2 overflow-hidden transition-all border-indigo-700 hover:border-indigo-400"
                    >
                      <img src={toAbsoluteUrl(img.url)} alt={img.name} className="w-full h-full object-cover"
                        onError={e => { e.currentTarget.style.opacity = '0.3' }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      {/* Settings bar — hidden on Publish tab */}
        {activeTab !== 'publish' && <div className="bg-gray-900 border border-gray-800 p-3 space-y-3">

          {/* Model selector */}
          <div className="flex items-center gap-3">
            <label className="text-gray-500 text-xs w-16 flex-shrink-0">Model</label>
            <select
              value={activeTab === 'mockup' ? imageModel : videoModel}
              onChange={e => activeTab === 'mockup' ? setImageModel(e.target.value) : setVideoModel(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-xs px-3 py-1.5 focus:outline-none focus:border-indigo-500 flex-1 min-w-0"
            >
              {(activeTab === 'mockup' ? IMAGE_MODELS : VIDEO_MODELS).map(m => (
                <option key={m.id} value={m.id}>
                  {m.badge ? `${m.badge} ` : ''}{m.label} — {activeTab === 'mockup'
                    ? m.cost
                    : `$${(m.secRate * parseFloat(videoDuration)).toFixed(3)}/${videoDuration}s`}
                </option>
              ))}
            </select>
          </div>

          {/* Image size pills */}
          {activeTab === 'mockup' && (
            <div className="flex items-center gap-3">
              <label className="text-gray-500 text-xs w-16 flex-shrink-0">Size</label>
              <div className="flex gap-1 flex-wrap items-center">
                {IMAGE_SIZES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setImageSize(s.id)}
                    title={s.desc}
                    className={`px-2 py-0.5 text-xs border transition-colors ${
                      imageSize === s.id
                        ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30'
                        : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
                <span className="text-gray-600 text-xs ml-1">
                  {IMAGE_SIZES.find(s => s.id === imageSize)?.desc}
                </span>
              </div>
            </div>
          )}

          {/* Video duration */}
          {activeTab === 'video' && (
            <div className="flex items-center gap-3">
              <label className="text-gray-500 text-xs w-16 flex-shrink-0">Duration</label>
              <div className="flex gap-1 items-center">
                {['5', '10'].map(d => (
                  <button
                    key={d}
                    onClick={() => setVideoDuration(d)}
                    className={`px-3 py-0.5 text-xs border transition-colors ${
                      videoDuration === d
                        ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30'
                        : 'border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
                <span className="text-gray-600 text-xs ml-2">
                  ≈ ${((selectedVideoModel?.secRate ?? 0) * parseFloat(videoDuration)).toFixed(3)}
                </span>
              </div>
            </div>
          )}

        </div>}

        {/* No images warning — hidden on Publish tab */}
        {activeTab !== 'publish' && allImages.length === 0 && (
          <div className="bg-yellow-900/20 border border-yellow-800/50 px-4 py-3 text-yellow-400 text-xs">
            ⚠ No reference images available. Fetch &amp; import Gelato mockups first, or save the product to enable image generation.
          </div>
        )}

        {/* Generate All — hidden on Publish tab */}
        {activeTab !== 'publish' && currentTemplates.length > 1 && allImages.length > 0 && (
          <button
            onClick={() => handleGenerateAll(currentTemplates, activeTab === 'video')}
            disabled={generatingAll}
            className={`w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold tracking-wider uppercase border transition-colors ${
              generatingAll
                ? 'border-indigo-800 text-indigo-600 cursor-not-allowed'
                : 'border-indigo-600 text-indigo-300 hover:bg-indigo-900/30 hover:border-indigo-400'
            }`}
          >
            {generatingAll ? (
              <>
                <span className="animate-spin inline-block w-3 h-3 border border-indigo-400 border-t-transparent rounded-full flex-shrink-0" />
                Generating {allProgress.done} / {allProgress.total}…
              </>
            ) : (
              <>{activeTab === 'video' ? '🎬' : '🖼'} Generate All ({currentTemplates.length})</>
            )}
          </button>
        )}

        {/* Prompt cards — hidden on Publish tab */}
        {activeTab !== 'publish' && (
          <div className="space-y-4">
            {currentTemplates.map(t => (
              <PromptCard
                key={t.id}
                template={t}
                isVideo={activeTab === 'video'}
                promptText={localPrompts[t.id] ?? ''}
                onPromptChange={val => setLocalPrompts(prev => ({ ...prev, [t.id]: val }))}
                result={results[t.id]}
                onGenerate={() => activeTab === 'video' ? handleGenerateVideo(t.id) : handleGenerateImage(t.id)}
                onSave={(url, type) => handleSaveAsset(t.id, url, type)}
                onSavePrompt={() => handleSavePrompt(t.id, activeTab === 'video')}
                savingPrompt={savingPrompts[t.id]}
                savedPromptMsg={savedPromptMsgs[t.id]}
                images={allImages}
                selectedImage={getSelectedImage(t.id)}
                onSelectImage={img => setSelectedImages(prev => ({ ...prev, [t.id]: img }))}
                activeModel={promptSettings[t.id]?.modelId || null}
                activeSize={promptSettings[t.id]?.imageSize || null}
                onModelChange={val => setPromptSettings(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), modelId: val } }))}
                onSizeChange={val => setPromptSettings(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), imageSize: val } }))}
                models={activeTab === 'mockup' ? IMAGE_MODELS : VIDEO_MODELS}
                imageSizes={IMAGE_SIZES}
              />
            ))}
          </div>
        )}

        {/* ── Publish tab ──────────────────────────────────────────────────── */}
        {activeTab === 'publish' && (
          <PublishPanel
            personas={personas || []}
            selectedPersonaId={selectedPersonaId}
            onSelectPersona={setSelectedPersonaId}
            results={results}
            productName={productName}
            instagramCaption={instagramCaption}
            pinterestCaption={pinterestCaption}
            hashtags={hashtags}
          />
        )}

      </div>
    </div>
  )
}

// ── Publish Panel (module-level) ─────────────────────────────────────────────

const PLATFORM_COPY = {
  instagram: {
    label: 'Instagram',
    color: 'text-pink-400',
    border: 'border-pink-900/50 hover:border-pink-700',
    icon: '📸',
    url: 'https://www.instagram.com',
    hint: 'Opens Instagram — paste caption + upload media manually',
  },
  tiktok: {
    label: 'TikTok',
    color: 'text-gray-300',
    border: 'border-gray-700 hover:border-gray-500',
    icon: '🎵',
    url: 'https://www.tiktok.com/upload',
    hint: 'Opens TikTok upload — paste caption + upload video manually',
  },
  youtube: {
    label: 'YouTube Studio',
    color: 'text-red-400',
    border: 'border-red-900/50 hover:border-red-700',
    icon: '▶',
    url: 'https://studio.youtube.com',
    hint: 'Opens YouTube Studio — upload video manually',
  },
  pinterest: {
    label: 'Pinterest',
    color: 'text-red-300',
    border: 'border-red-800/40 hover:border-red-600',
    icon: '📌',
    url: 'https://www.pinterest.com/pin-builder/',
    hint: 'Opens Pinterest Pin builder — paste description + upload image',
  },
}

function PlatformButton({ platform, persona, caption, onCopy }) {
  const cfg    = PLATFORM_COPY[platform]
  const handle = persona?.[platform]
  if (!handle && !cfg) return null

  const handleClick = async () => {
    // Copy caption to clipboard then open platform
    try { await navigator.clipboard.writeText(caption || '') } catch {}
    onCopy(platform)
    window.open(handle || cfg.url, '_blank', 'noopener noreferrer')
  }

  return (
    <button
      onClick={handleClick}
      title={cfg.hint}
      className={`flex items-center gap-2 px-4 py-2.5 border text-xs font-medium transition-colors ${cfg.border}`}
    >
      <span>{cfg.icon}</span>
      <span className={cfg.color}>{cfg.label}</span>
      {handle && <span className="text-gray-600 text-xs truncate max-w-32">{handle.replace(/^https?:\/\/(www\.)?[^/]+\//, '@')}</span>}
    </button>
  )
}

function PublishPanel({ personas, selectedPersonaId, onSelectPersona, results, productName, instagramCaption, pinterestCaption, hashtags }) {
  const persona = personas.find(p => p.id === selectedPersonaId) ?? null
  const [caption, setCaption]   = useState(instagramCaption || '')
  const [copied,  setCopied]    = useState('')

  useEffect(() => {
    const base = instagramCaption
      || (productName ? `Just dropped: ${productName} 🖤 Link in bio.` : '')
    setCaption(base + (hashtags ? '\n\n' + hashtags : ''))
  }, [instagramCaption, hashtags, productName])

  const handleCopy = (platform) => {
    setCopied(platform)
    setTimeout(() => setCopied(''), 2500)
  }

  const handleCopyCaption = async () => {
    try { await navigator.clipboard.writeText(caption) } catch {}
    setCopied('caption')
    setTimeout(() => setCopied(''), 2000)
  }

  // Collect all generated media
  const allResults = Object.entries(results).map(([id, r]) => ({ id, ...r }))
  const images = allResults.filter(r => r.imageUrl && r.status === 'done')
  const videos = allResults.filter(r => r.videoUrl && r.status === 'done')

  return (
    <div className="space-y-5">
      {/* Persona picker */}
      {personas.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 p-4 space-y-3">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Publishing as…</p>
          <div className="flex gap-2 flex-wrap">
            {personas.map(p => (
              <button
                key={p.id}
                onClick={() => onSelectPersona(p.id === selectedPersonaId ? '' : p.id)}
                className={`flex items-center gap-2 px-3 py-2 border text-xs transition-colors ${
                  p.id === selectedPersonaId
                    ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300'
                    : 'border-gray-700 hover:border-gray-600 text-gray-400'
                }`}
              >
                {p.referenceImages?.[0] && (
                  <img src={p.referenceImages[0]} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
                )}
                {p.name}
                <span className="text-gray-600">{p.handle}</span>
              </button>
            ))}
          </div>

          {persona && (
            <div className="flex gap-3 pt-1">
              {['instagram', 'tiktok', 'youtube'].filter(k => persona[k]).map(k => (
                <a key={k} href={persona[k]} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2">
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Caption editor */}
      <div className="bg-gray-900 border border-gray-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Caption</p>
          <button
            onClick={handleCopyCaption}
            className={`text-xs transition-colors ${copied === 'caption' ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {copied === 'caption' ? '✓ Copied!' : '📋 Copy all'}
          </button>
        </div>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          rows={6}
          placeholder="Your caption will appear here after generating listing content (✨ Generate with AI on the product)…"
          className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs px-3 py-2 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {pinterestCaption && (
          <div className="pt-1">
            <p className="text-gray-600 text-xs mb-1.5">Pinterest caption:</p>
            <p className="text-gray-400 text-xs leading-relaxed">{pinterestCaption}</p>
            <button
              onClick={async () => { await navigator.clipboard.writeText(pinterestCaption).catch(() => {}); handleCopy('pinterest-text') }}
              className={`mt-1 text-xs transition-colors ${copied === 'pinterest-text' ? 'text-green-400' : 'text-gray-600 hover:text-gray-400'}`}
            >
              {copied === 'pinterest-text' ? '✓ Copied' : '📋 Copy Pinterest caption'}
            </button>
          </div>
        )}
      </div>

      {/* Platform buttons */}
      <div className="bg-gray-900 border border-gray-800 p-4 space-y-3">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Post to channel</p>
        <p className="text-gray-600 text-xs">Clicking copies your caption, then opens the platform. Upload your media manually.</p>
        <div className="flex gap-2 flex-wrap">
          {['instagram', 'tiktok', 'youtube', 'pinterest'].map(platform => (
            <PlatformButton
              key={platform}
              platform={platform}
              persona={persona}
              caption={platform === 'pinterest' ? (pinterestCaption || caption) : caption}
              onCopy={handleCopy}
            />
          ))}
        </div>
        {copied && copied !== 'caption' && copied !== 'pinterest-text' && (
          <p className="text-green-400 text-xs">✓ Caption copied — now paste it on {copied}!</p>
        )}
      </div>

      {/* Generated media to post */}
      {(images.length > 0 || videos.length > 0) && (
        <div className="bg-gray-900 border border-gray-800 p-4 space-y-3">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Your generated media</p>
          <div className="flex gap-3 flex-wrap">
            {images.map(r => (
              <div key={r.id} className="space-y-1">
                <img src={r.imageUrl} alt="" className="w-28 h-28 object-cover border border-gray-700" />
                <a
                  href={r.imageUrl}
                  download={`${r.id}.jpg`}
                  className="block text-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >⬇ Download</a>
              </div>
            ))}
            {videos.map(r => (
              <div key={r.id} className="space-y-1">
                <video src={r.videoUrl} className="w-28 h-28 object-cover border border-gray-700" />
                <a
                  href={r.videoUrl}
                  download={`${r.id}.mp4`}
                  className="block text-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >⬇ Download</a>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs">Download media → upload manually on the platform after copying the caption above.</p>
        </div>
      )}

      {images.length === 0 && videos.length === 0 && (
        <p className="text-gray-600 text-xs text-center py-4">Generate images or videos first (Mockup/Video tabs) to see them here for download.</p>
      )}
    </div>
  )
}
