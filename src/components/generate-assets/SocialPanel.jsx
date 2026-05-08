import { useState, useEffect, useRef } from 'react'
import { generatePrompts as staticPrompts } from '@/data/generate-prompts'
import PromptCard from './PromptCard'
import {
  api, IMAGE_MODELS, VIDEO_MODELS, IMAGE_SIZES, SOCIAL_META, PRODUCT_TYPE_META,
  subVars, toAbsoluteUrl,
} from './constants'

// ── Platforms to show (order matters) ────────────────────────────────────────
const PLATFORMS = ['instagram', 'tiktok', 'pinterest', 'facebook', 'youtube']

// ── PlatformCopyPanel ─────────────────────────────────────────────────────────
function PlatformCopyPanel({ copy, platform, onRegenerate, generating }) {
  const [copied, setCopied] = useState(null)
  const meta = SOCIAL_META[platform]

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const FIELDS = [
    { key: 'caption',         label: 'Caption',       multi: true  },
    { key: 'hashtags',        label: 'Hashtags',      multi: false },
    { key: 'altText',         label: 'Alt Text',      multi: false },
    { key: 'seoTitle',        label: 'SEO Title',     multi: false },
    { key: 'seoDescription',  label: 'SEO Desc',      multi: true  },
  ]

  return (
    <div className={`border ${meta.activeBorder} ${meta.activeBg} p-3 space-y-2 mt-2`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold ${meta.color}`}>✨ Copy generata</span>
        <button onClick={onRegenerate} disabled={generating}
          className={`text-xs transition-colors ${generating ? 'text-gray-600' : `${meta.color} hover:opacity-70`}`}>
          {generating ? '…' : '↺ Rigenera'}
        </button>
      </div>
      {FIELDS.map(({ key, label, multi }) => copy[key] ? (
        <div key={key} className="flex items-start gap-2">
          <span className="text-gray-600 text-[10px] w-16 flex-shrink-0 pt-0.5 uppercase tracking-wider">{label}</span>
          <p className={`text-gray-300 text-xs flex-1 leading-relaxed ${multi ? '' : 'truncate'}`}>{copy[key]}</p>
          <button onClick={() => copyText(copy[key], key)}
            className="text-gray-600 hover:text-gray-300 text-[10px] flex-shrink-0 transition-colors whitespace-nowrap">
            {copied === key ? '✓' : 'Copy'}
          </button>
        </div>
      ) : null)}
    </div>
  )
}

// ── Main SocialPanel ──────────────────────────────────────────────────────────
export default function SocialPanel({
  productId, productName, productType, primaryColor, collection,
  allImages, onAssetSaved,
}) {
  const [activeProduct,    setActiveProduct]    = useState('tshirt')
  const [expandedPlatform, setExpandedPlatform] = useState('instagram')
  const [imageModel,       setImageModel]       = useState(IMAGE_MODELS[0].id)
  const [videoModel,       setVideoModel]       = useState(VIDEO_MODELS[0].id)
  const [imageSize,        setImageSize]        = useState('portrait_4_3')
  const [videoDuration,    setVideoDuration]    = useState('5')

  // Per-prompt state (keyed by template id)
  const [localPrompts,   setLocalPrompts]   = useState({})
  const [promptSettings, setPromptSettings] = useState({})
  const [selectedImages, setSelectedImages] = useState({})
  const [results,        setResults]        = useState({})

  // Per-platform state
  const [platformCopy,   setPlatformCopy]   = useState({})
  const [generatingCopy, setGeneratingCopy] = useState({})
  const [publishing,     setPublishing]     = useState({})
  const [publishMsgs,    setPublishMsgs]    = useState({})

  // Auto-generate all state
  const [autoRunning,  setAutoRunning]  = useState(false)
  const [autoProgress, setAutoProgress] = useState({ done: 0, total: 0, current: '' })

  const pollTimers = useRef({})

  // ── Init local prompts from static data ──────────────────────────────────
  useEffect(() => {
    const v = { name: productName, type: productType, color: primaryColor, collection }
    const social = staticPrompts.social || {}
    const local = {}
    for (const platform of Object.keys(social)) {
      for (const pType of Object.keys(social[platform])) {
        const { image = [], video = [] } = social[platform][pType]
        for (const t of [...image, ...video]) {
          local[t.id] = subVars(t.prompt, v)
        }
      }
    }
    setLocalPrompts(local)
  }, [productName, productType, primaryColor, collection])

  useEffect(() => () => { Object.values(pollTimers.current).forEach(clearInterval) }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const patchResult = (id, patch) =>
    setResults(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))

  const getSelectedImage = (templateId) => {
    if (selectedImages[templateId]) return selectedImages[templateId]
    const savedRef = promptSettings[templateId]?.referenceUrl
    if (savedRef) return { url: savedRef, name: 'Pinned', _isPinned: true }
    return allImages[0] ?? null
  }

  const getTemplates = (platform) =>
    staticPrompts.social?.[platform]?.[activeProduct] || { image: [], video: [] }

  const getDoneCount = (platform) => {
    const { image, video } = getTemplates(platform)
    return [...image, ...video].filter(t => results[t.id]?.status === 'done').length
  }

  // ── Image generation ─────────────────────────────────────────────────────
  const handleGenerateImage = async (templateId) => {
    const prompt = localPrompts[templateId]
    if (!prompt?.trim()) return
    const ps         = promptSettings[templateId] || {}
    const modelToUse = ps.modelId   || imageModel
    const sizeToUse  = ps.imageSize || imageSize
    const imgObj     = getSelectedImage(templateId)
    const imageUrl   = imgObj ? toAbsoluteUrl(imgObj.url) : undefined
    patchResult(templateId, { status: 'generating', error: null, imageUrl: null, saved: false })
    try {
      const res  = await fetch('/api/generate-mockup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: modelToUse, prompt: prompt.trim(), imageSize: sizeToUse, imageUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      patchResult(templateId, { status: 'done', imageUrl: data.imageUrl })
    } catch (e) {
      patchResult(templateId, { status: 'error', error: e.message })
    }
  }

  // ── Video generation ─────────────────────────────────────────────────────
  const handleGenerateVideo = async (templateId) => {
    const prompt = localPrompts[templateId]
    if (!prompt?.trim()) return
    const ps         = promptSettings[templateId] || {}
    const modelToUse = ps.modelId || videoModel
    const imgObj     = getSelectedImage(templateId)
    const imageUrl   = imgObj ? toAbsoluteUrl(imgObj.url) : undefined
    patchResult(templateId, { status: 'submitting', error: null, videoUrl: null, requestId: null, progress: 0, saved: false })
    try {
      const submitRes  = await fetch('/api/generate-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', modelId: modelToUse, prompt: prompt.trim(), duration: videoDuration, imageUrl }),
      })
      const submitData = await submitRes.json()
      if (!submitRes.ok) throw new Error(submitData.error || 'Submit failed')
      const requestId = submitData.requestId
      if (!requestId) throw new Error('No requestId')
      patchResult(templateId, { status: 'processing', requestId, progress: 10 })
      const poll = async () => {
        try {
          const sRes  = await fetch('/api/generate-video', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status', modelId: modelToUse, requestId }),
          })
          const sData = await sRes.json()
          const st = sData.status
          if (st === 'COMPLETED') {
            clearInterval(pollTimers.current[requestId])
            delete pollTimers.current[requestId]
            const rRes  = await fetch('/api/generate-video', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'result', modelId: modelToUse, requestId }),
            })
            const rData = await rRes.json()
            if (!rRes.ok) throw new Error(rData.error)
            patchResult(templateId, { status: 'done', videoUrl: rData.videoUrl, progress: 100 })
          } else if (st === 'FAILED') {
            clearInterval(pollTimers.current[requestId])
            delete pollTimers.current[requestId]
            patchResult(templateId, { status: 'error', error: 'Generation failed' })
          } else {
            patchResult(templateId, { progress: st === 'IN_PROGRESS' ? 60 : 20 })
          }
        } catch (e) { console.warn('[social-video-poll]', e.message) }
      }
      pollTimers.current[requestId] = setInterval(poll, 3000)
    } catch (e) {
      patchResult(templateId, { status: 'error', error: e.message })
    }
  }

  // ── Generate copy for a platform ─────────────────────────────────────────
  const handleGenerateCopy = async (platform) => {
    setGeneratingCopy(prev => ({ ...prev, [platform]: true }))
    try {
      const data = await api('generate-copy', {
        productName, productType, collection,
        social: platform,
        selectedAssets: Object.entries(results)
          .filter(([, r]) => r?.status === 'done')
          .map(([id]) => id),
      })
      setPlatformCopy(prev => ({ ...prev, [platform]: data.copy }))
    } catch (e) {
      console.warn('generate-copy failed', e.message)
    } finally {
      setGeneratingCopy(prev => ({ ...prev, [platform]: false }))
    }
  }

  // ── Publish for a platform (atomic: save + hero + SEO) ───────────────────
  const handlePublish = async (platform) => {
    if (!productId) return
    setPublishing(prev => ({ ...prev, [platform]: true }))
    setPublishMsgs(prev => ({ ...prev, [platform]: '' }))
    try {
      const { image, video } = getTemplates(platform)
      const doneAssets = [...image, ...video]
        .map(t => ({ id: t.id, ...results[t.id] }))
        .filter(r => r.status === 'done' && (r.imageUrl || r.videoUrl))
        .map(({ id, imageUrl, videoUrl }) => ({ id, imageUrl: imageUrl || null, videoUrl: videoUrl || null }))

      if (doneAssets.length === 0) throw new Error('Nessun asset generato da pubblicare')

      await api('publish-social-asset', {
        productId,
        platform,
        assets:  doneAssets,
        copy:    platformCopy[platform] || {},
      })

      setPublishMsgs(prev => ({ ...prev, [platform]: '✓ Pubblicato' }))
      setTimeout(() => setPublishMsgs(prev => ({ ...prev, [platform]: '' })), 3000)
    } catch (e) {
      setPublishMsgs(prev => ({ ...prev, [platform]: `⚠ ${e.message}` }))
      setTimeout(() => setPublishMsgs(prev => ({ ...prev, [platform]: '' })), 4000)
    } finally {
      setPublishing(prev => ({ ...prev, [platform]: false }))
    }
  }

  // ── Auto-generate all (images only, skips video for speed) ───────────────
  const handleAutoGenerate = async () => {
    if (autoRunning) return
    setAutoRunning(true)

    const allTasks = []
    for (const platform of PLATFORMS) {
      const { image } = getTemplates(platform)
      for (const t of image) {
        if (results[t.id]?.status !== 'done') allTasks.push({ id: t.id, type: 'image', platform })
      }
    }

    setAutoProgress({ done: 0, total: allTasks.length, current: '' })

    for (let i = 0; i < allTasks.length; i++) {
      const { id, platform } = allTasks[i]
      const meta = SOCIAL_META[platform]
      setAutoProgress({ done: i, total: allTasks.length, current: `${meta.icon} ${localPrompts[id]?.slice(0, 40) || id}` })
      await handleGenerateImage(id)
      setAutoProgress(p => ({ ...p, done: i + 1 }))
    }

    setAutoRunning(false)
    setAutoProgress({ done: 0, total: 0, current: '' })
  }

  // ── PromptCard shared props builder ─────────────────────────────────────
  const promptCardProps = (t, isVideo) => ({
    template:        t,
    isVideo,
    promptText:      localPrompts[t.id] ?? '',
    onPromptChange:  val => setLocalPrompts(prev => ({ ...prev, [t.id]: val })),
    result:          results[t.id],
    onGenerate:      () => isVideo ? handleGenerateVideo(t.id) : handleGenerateImage(t.id),
    onSave:          (url, type) => {
      api('import-generated-asset', { productId, assetUrl: url, assetType: type })
        .then(data => { if (type === 'image') onAssetSaved?.(data.path) })
        .catch(() => {})
    },
    images:          allImages,
    extraRefs:       promptSettings[t.id]?.extraRefs || [],
    onAddExtraRef:   ref => setPromptSettings(prev => {
      const ps = prev[t.id] || {}; const refs = ps.extraRefs || []
      if (refs.some(r => r.url === ref.url)) return prev
      return { ...prev, [t.id]: { ...ps, extraRefs: [...refs, ref] } }
    }),
    onRemoveExtraRef: url => setPromptSettings(prev => {
      const ps = prev[t.id] || {}
      return { ...prev, [t.id]: { ...ps, extraRefs: (ps.extraRefs || []).filter(r => r.url !== url) } }
    }),
    selectedImage:   getSelectedImage(t.id),
    onSelectImage:   img => setSelectedImages(prev => ({ ...prev, [t.id]: img })),
    activeModel:     promptSettings[t.id]?.modelId || null,
    activeSize:      promptSettings[t.id]?.imageSize || null,
    onModelChange:   val => setPromptSettings(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), modelId: val } })),
    onSizeChange:    val => setPromptSettings(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), imageSize: val } })),
    models:          isVideo ? VIDEO_MODELS : IMAGE_MODELS,
    imageSizes:      IMAGE_SIZES,
  })

  const selectedVideoModel = VIDEO_MODELS.find(m => m.id === videoModel)

  return (
    <div>

      {/* ── Top bar: product type + global settings ─────────────────────── */}
      <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-900/40 flex flex-wrap items-center gap-3">

        {/* Product type */}
        <div className="flex items-center gap-1.5">
          {Object.entries(PRODUCT_TYPE_META).map(([pType, meta]) => (
            <button key={pType} onClick={() => setActiveProduct(pType)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs border transition-colors ${
                activeProduct === pType
                  ? 'border-pink-500 text-pink-300 bg-pink-900/20'
                  : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
              }`}>
              {meta.icon} <span className="hidden sm:inline">{meta.label}</span>
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-700" />

        {/* Models */}
        <select value={imageModel} onChange={e => setImageModel(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 focus:outline-none">
          {IMAGE_MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.badge ? `${m.badge} ` : ''}📸 {m.label} {m.cost}</option>
          ))}
        </select>

        <select value={videoModel} onChange={e => setVideoModel(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 focus:outline-none">
          {VIDEO_MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.badge ? `${m.badge} ` : ''}🎬 {m.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          {['5','10'].map(d => (
            <button key={d} onClick={() => setVideoDuration(d)}
              className={`px-2 py-0.5 text-xs border transition-colors ${
                videoDuration === d ? 'border-blue-500 text-blue-300' : 'border-gray-700 text-gray-600 hover:border-gray-500'
              }`}>{d}s</button>
          ))}
          <span className="text-gray-600 text-xs">≈${((selectedVideoModel?.secRate ?? 0) * parseFloat(videoDuration)).toFixed(3)}</span>
        </div>

        {/* Auto-generate all */}
        <button onClick={handleAutoGenerate} disabled={autoRunning || allImages.length === 0}
          className={`ml-auto flex items-center gap-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
            autoRunning || allImages.length === 0
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-pink-700 hover:bg-pink-600 text-white cursor-pointer'
          }`}>
          {autoRunning
            ? <><span className="animate-spin w-3 h-3 border border-pink-300 border-t-transparent rounded-full inline-block" /> {autoProgress.done}/{autoProgress.total}</>
            : '🤖 Auto-generate tutte le immagini'
          }
        </button>
      </div>

      {/* Auto-generate progress */}
      {autoRunning && autoProgress.current && (
        <div className="px-4 py-1.5 bg-pink-900/10 border-b border-pink-900/30 text-pink-400 text-xs truncate">
          Generating: {autoProgress.current}
        </div>
      )}

      {allImages.length === 0 && (
        <div className="mx-4 mt-3 bg-yellow-900/20 border border-yellow-800/50 px-3 py-2 text-yellow-400 text-xs">
          ⚠ Nessuna immagine di riferimento — importa i mockup Gelato prima.
        </div>
      )}

      {/* ── Platform accordion ──────────────────────────────────────────── */}
      <div>
        {PLATFORMS.map(platform => {
          const meta       = SOCIAL_META[platform]
          const templates  = getTemplates(platform)
          const allTpls    = [...templates.image, ...templates.video]
          const doneCount  = getDoneCount(platform)
          const isExpanded = expandedPlatform === platform
          const hasCopy    = !!platformCopy[platform]
          const isPublishing = publishing[platform]

          return (
            <div key={platform} className="border-b border-gray-800">

              {/* Platform header row */}
              <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-900/20 transition-colors">

                {/* Expand toggle */}
                <button onClick={() => setExpandedPlatform(isExpanded ? null : platform)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  <span className="text-xl leading-none">{meta.icon}</span>
                  <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                  <span className="text-gray-600 text-xs">{allTpls.length} prompt</span>
                  {doneCount > 0 && (
                    <span className="text-emerald-400 text-xs font-medium">·{doneCount} ✓</span>
                  )}
                  <span className={`text-gray-500 text-xs ml-2 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                </button>

                {/* GPT Copy button */}
                <button onClick={() => handleGenerateCopy(platform)}
                  disabled={generatingCopy[platform] || doneCount === 0}
                  title="Genera copy (caption, hashtag, SEO)"
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs border transition-colors ${
                    generatingCopy[platform] || doneCount === 0
                      ? 'border-gray-800 text-gray-700 cursor-not-allowed'
                      : `${meta.activeBorder} ${meta.color} hover:${meta.activeBg} cursor-pointer`
                  }`}>
                  {generatingCopy[platform]
                    ? <span className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full inline-block" />
                    : '✨'
                  }
                  <span className="hidden sm:inline">Copy</span>
                </button>

                {/* Publish button */}
                <button onClick={() => handlePublish(platform)}
                  disabled={isPublishing || doneCount === 0}
                  title="Pubblica: salva mockup + hero + SEO sul prodotto"
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isPublishing || doneCount === 0
                      ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-pink-700 hover:bg-pink-600 text-white cursor-pointer'
                  }`}>
                  {isPublishing
                    ? <span className="animate-spin w-3 h-3 border border-pink-300 border-t-transparent rounded-full inline-block" />
                    : publishMsgs[platform] || '🚀'
                  }
                  <span className="hidden sm:inline">{publishMsgs[platform] || 'Publish'}</span>
                </button>
              </div>

              {/* Copy preview strip (collapsed) */}
              {hasCopy && !isExpanded && (
                <div className="px-14 pb-2 flex gap-3 items-center">
                  <span className={`text-[10px] ${meta.color} opacity-60`}>✨</span>
                  <span className="text-gray-500 text-xs truncate max-w-sm italic">
                    {platformCopy[platform].caption?.slice(0, 90)}…
                  </span>
                </div>
              )}

              {/* ── Expanded content ──────────────────────────────────── */}
              {isExpanded && (
                <div className="px-4 pb-5 pt-2 space-y-5 border-t border-gray-800/50">

                  {/* Image prompts */}
                  {templates.image.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${meta.color}`}>📸 Immagini</span>
                        <span className="text-gray-600 text-xs">{templates.image.length}</span>
                      </div>
                      {templates.image.map(t => (
                        <PromptCard key={t.id} {...promptCardProps(t, false)} />
                      ))}
                    </div>
                  )}

                  {/* Video prompts */}
                  {templates.video.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${meta.color}`}>🎬 Video</span>
                        <span className="text-gray-600 text-xs">{templates.video.length}</span>
                      </div>
                      {templates.video.map(t => (
                        <PromptCard key={t.id} {...promptCardProps(t, true)} />
                      ))}
                    </div>
                  )}

                  {/* Copy panel */}
                  {hasCopy && (
                    <PlatformCopyPanel
                      copy={platformCopy[platform]}
                      platform={platform}
                      generating={generatingCopy[platform]}
                      onRegenerate={() => handleGenerateCopy(platform)}
                    />
                  )}

                  {!hasCopy && doneCount > 0 && (
                    <button onClick={() => handleGenerateCopy(platform)}
                      disabled={generatingCopy[platform]}
                      className={`w-full py-2 text-xs border border-dashed transition-colors ${meta.activeBorder} ${meta.color} hover:${meta.activeBg}`}>
                      {generatingCopy[platform] ? 'Generando copy…' : '✨ Genera caption, hashtag e SEO'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
