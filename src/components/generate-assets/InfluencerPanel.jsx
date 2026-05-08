import { useState, useEffect, useRef } from 'react'
import PromptCard from './PromptCard'
import {
  api, ADMIN_PASSWORD, IMAGE_MODELS, VIDEO_MODELS, IMAGE_SIZES,
  SOCIAL_META, toAbsoluteUrl, subVars,
} from './constants'

// ── Platforms available in influencer workspace ───────────────────────────────
const INFLUENCER_PLATFORMS = ['instagram', 'tiktok', 'pinterest', 'facebook']

// ── Default prompts grouped by platform ──────────────────────────────────────
function defaultInfluencerPrompts(persona) {
  const ctx = persona.promptContext || persona.aesthetic || ''
  return {
    instagram: {
      image: [
        { id: `${persona.id}-ig-img-1`, name: 'Street Shot',    prompt: ctx ? `${ctx} — wearing the product, editorial street photography, warm tones` : 'Editorial street photography wearing the product' },
        { id: `${persona.id}-ig-img-2`, name: 'Studio Clean',   prompt: ctx ? `${ctx} — clean studio portrait with product, minimal background` : 'Clean studio portrait with product' },
      ],
      video: [
        { id: `${persona.id}-ig-vid-1`, name: 'Lifestyle Reel', prompt: ctx ? `${ctx} — lifestyle reel wearing the product, energetic movement, good vibes` : 'Lifestyle reel wearing the product' },
      ],
    },
    tiktok: {
      image: [
        { id: `${persona.id}-tt-img-1`, name: 'GRWM Shot',      prompt: ctx ? `${ctx} — get ready with me style, casual, authentic, TikTok aesthetic` : 'Casual authentic shot for TikTok' },
      ],
      video: [
        { id: `${persona.id}-tt-vid-1`, name: 'Unboxing',       prompt: ctx ? `${ctx} — unboxing reaction video, excited energy, fast cuts` : 'Unboxing reaction video' },
        { id: `${persona.id}-tt-vid-2`, name: 'POV Trend',      prompt: ctx ? `${ctx} — POV trend video wearing product, trending audio context` : 'POV trend video with product' },
      ],
    },
    pinterest: {
      image: [
        { id: `${persona.id}-pin-img-1`, name: 'Moodboard',     prompt: ctx ? `${ctx} — aesthetic flat lay with product, soft lighting, Pinterest worthy` : 'Aesthetic flat lay with product' },
        { id: `${persona.id}-pin-img-2`, name: 'Lifestyle',     prompt: ctx ? `${ctx} — aspirational lifestyle shot with product, magazine quality` : 'Aspirational lifestyle shot with product' },
      ],
      video: [],
    },
    facebook: {
      image: [
        { id: `${persona.id}-fb-img-1`, name: 'Community',      prompt: ctx ? `${ctx} — relatable everyday moment with product, community vibe` : 'Relatable everyday moment with product' },
      ],
      video: [
        { id: `${persona.id}-fb-vid-1`, name: 'Story Time',     prompt: ctx ? `${ctx} — storytelling style video with product, speaking to camera` : 'Storytelling video with product' },
      ],
    },
  }
}

// ── PlatformCopyPanel ─────────────────────────────────────────────────────────
function InfluencerCopyPanel({ copy, platform, onRegenerate, generating }) {
  const [copied, setCopied] = useState(null)
  const meta = SOCIAL_META[platform]

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const FIELDS = [
    { key: 'caption',        label: 'Caption',  multi: true  },
    { key: 'hashtags',       label: 'Hashtags', multi: false },
    { key: 'altText',        label: 'Alt Text', multi: false },
  ]

  return (
    <div className={`border ${meta.activeBorder} ${meta.activeBg} p-3 space-y-2`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold ${meta.color}`}>✨ Copy</span>
        <button onClick={onRegenerate} disabled={generating}
          className={`text-xs transition-colors ${generating ? 'text-gray-600' : `${meta.color} hover:opacity-70`}`}>
          {generating ? '…' : '↺ Rigenera'}
        </button>
      </div>
      {FIELDS.map(({ key, label, multi }) => copy[key] ? (
        <div key={key} className="flex items-start gap-2">
          <span className="text-gray-600 text-[10px] w-14 flex-shrink-0 pt-0.5 uppercase tracking-wider">{label}</span>
          <p className={`text-gray-300 text-xs flex-1 leading-relaxed ${multi ? '' : 'truncate'}`}>{copy[key]}</p>
          <button onClick={() => copyText(copy[key], key)}
            className="text-gray-600 hover:text-gray-300 text-[10px] flex-shrink-0 transition-colors">
            {copied === key ? '✓' : 'Copy'}
          </button>
        </div>
      ) : null)}
    </div>
  )
}

// ── Connect instructions ──────────────────────────────────────────────────────
function ConnectBanner({ platform, info, onDismiss }) {
  const meta = SOCIAL_META[platform]
  return (
    <div className="bg-gray-900 border border-yellow-800/60 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-yellow-400 text-xs font-semibold">🔗 Connetti {meta.label}</span>
        <button onClick={onDismiss} className="ml-auto text-gray-600 hover:text-gray-400 text-xs">✕</button>
      </div>
      <p className="text-gray-400 text-xs">{info.message}</p>
      {info.instructions && (
        <ol className="space-y-1">
          {info.instructions.map((step, i) => (
            <li key={i} className="text-gray-500 text-xs">{step}</li>
          ))}
        </ol>
      )}
    </div>
  )
}

// ── InfluencerWorkspace ───────────────────────────────────────────────────────
function InfluencerWorkspace({ persona, productId, productName, allImages, onAssetSaved }) {
  const [activePlatform,  setActivePlatform]  = useState('instagram')
  const [imageModel,      setImageModel]      = useState(IMAGE_MODELS[0].id)
  const [videoModel,      setVideoModel]      = useState(VIDEO_MODELS[0].id)
  const [imageSize,       setImageSize]       = useState('square_hd')
  const [videoDuration,   setVideoDuration]   = useState('5')

  // All per-prompt state
  const [localPrompts,    setLocalPrompts]    = useState({})
  const [promptSettings,  setPromptSettings]  = useState({})
  const [selectedImages,  setSelectedImages]  = useState({})
  const [results,         setResults]         = useState({})
  const [savingPrompts,   setSavingPrompts]   = useState({})
  const [savedMsgs,       setSavedMsgs]       = useState({})

  // Per-platform copy + publish state
  const [platformCopy,    setPlatformCopy]    = useState({})
  const [generatingCopy,  setGeneratingCopy]  = useState({})
  const [publishing,      setPublishing]      = useState({})
  const [publishMsgs,     setPublishMsgs]     = useState({})
  const [connectInfo,     setConnectInfo]     = useState({})

  const pollTimers = useRef({})

  // Prompts stored per platform in persona.prompts or use defaults
  const [personaPrompts, setPersonaPrompts] = useState(
    persona.prompts && typeof persona.prompts === 'object' && !Array.isArray(persona.prompts.mockup)
      ? persona.prompts
      : defaultInfluencerPrompts(persona)
  )

  useEffect(() => {
    const prompts = persona.prompts && typeof persona.prompts === 'object' && !Array.isArray(persona.prompts.mockup)
      ? persona.prompts
      : defaultInfluencerPrompts(persona)
    setPersonaPrompts(prompts)

    const local = {}
    for (const plat of INFLUENCER_PLATFORMS) {
      for (const t of [...(prompts[plat]?.image || []), ...(prompts[plat]?.video || [])]) {
        local[t.id] = t.prompt || ''
      }
    }
    setLocalPrompts(local)
    setResults({})
    setSelectedImages({})
  }, [persona.id]) // eslint-disable-line

  useEffect(() => () => { Object.values(pollTimers.current).forEach(clearInterval) }, [])

  const patchResult = (id, patch) =>
    setResults(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))

  // Reference images: influencer's own refs first, then product images
  const influencerRefs = (persona.referenceImages || []).map((url, i) => ({
    url, name: `${persona.name} ref ${i + 1}`, _isPersonaRef: true,
  }))
  const combinedImages = [...influencerRefs, ...allImages]

  const getSelectedImage = (templateId) => {
    if (selectedImages[templateId]) return selectedImages[templateId]
    const savedRef = promptSettings[templateId]?.referenceUrl
    if (savedRef) return { url: savedRef, name: 'Pinned', _isPinned: true }
    return influencerRefs[0] ?? allImages[0] ?? null
  }

  // ── Image generation ────────────────────────────────────────────────────────
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

  // ── Video generation ────────────────────────────────────────────────────────
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
        } catch (e) { console.warn('[influ-video-poll]', e.message) }
      }
      pollTimers.current[requestId] = setInterval(poll, 3000)
    } catch (e) {
      patchResult(templateId, { status: 'error', error: e.message })
    }
  }

  // ── Save asset to website ───────────────────────────────────────────────────
  const handleSaveAsset = async (templateId, assetUrl, assetType) => {
    if (!productId || !assetUrl) return
    patchResult(templateId, { saving: true })
    try {
      const data = await api('import-generated-asset', { productId, assetUrl, assetType })
      patchResult(templateId, { saving: false, saved: true })
      if (assetType === 'image') onAssetSaved?.(data.path)
    } catch (e) {
      patchResult(templateId, { saving: false, error: e.message })
    }
  }

  // ── Save prompt to persona ──────────────────────────────────────────────────
  const savePersonaPrompts = async (prompts) => {
    await api('save-persona-prompts', { personaId: persona.id, prompts })
  }

  const handleSavePrompt = async (templateId, platform, isVideo) => {
    setSavingPrompts(prev => ({ ...prev, [templateId]: true }))
    setSavedMsgs(prev => ({ ...prev, [templateId]: '' }))
    try {
      const category = isVideo ? 'video' : 'image'
      const ps       = promptSettings[templateId] || {}
      const selImg   = selectedImages[templateId] || null
      const updatedPrompts = {
        ...personaPrompts,
        [platform]: {
          ...personaPrompts[platform],
          [category]: (personaPrompts[platform]?.[category] || []).map(t => {
            if (t.id !== templateId) return t
            const extra = {}
            if (ps.modelId) extra[isVideo ? 'videoModelId' : 'modelId'] = ps.modelId
            if (ps.imageSize && !isVideo) extra.imageSize = ps.imageSize
            if (selImg?.url) extra.referenceUrl = selImg.url
            if (ps.extraRefs?.length) extra.extraRefs = ps.extraRefs
            return { ...t, prompt: localPrompts[templateId] ?? t.prompt, ...extra }
          }),
        },
      }
      await savePersonaPrompts(updatedPrompts)
      setPersonaPrompts(updatedPrompts)
      setSavedMsgs(prev => ({ ...prev, [templateId]: '✓' }))
      setTimeout(() => setSavedMsgs(prev => ({ ...prev, [templateId]: '' })), 2500)
    } catch {
      setSavedMsgs(prev => ({ ...prev, [templateId]: '⚠' }))
    } finally {
      setSavingPrompts(prev => ({ ...prev, [templateId]: false }))
    }
  }

  const handleAddPrompt = (platform, isVideo) => {
    const id       = `${persona.id}-${platform}-${isVideo ? 'vid' : 'img'}-${Date.now()}`
    const category = isVideo ? 'video' : 'image'
    const newPrompt = { id, name: 'New prompt', prompt: '' }
    setPersonaPrompts(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [category]: [...(prev[platform]?.[category] || []), newPrompt],
      },
    }))
    setLocalPrompts(prev => ({ ...prev, [id]: '' }))
  }

  const handleDeletePrompt = async (templateId, platform, isVideo) => {
    const category = isVideo ? 'video' : 'image'
    const updatedPrompts = {
      ...personaPrompts,
      [platform]: {
        ...personaPrompts[platform],
        [category]: (personaPrompts[platform]?.[category] || []).filter(t => t.id !== templateId),
      },
    }
    setPersonaPrompts(updatedPrompts)
    await savePersonaPrompts(updatedPrompts).catch(() => {})
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

  // ── Generate copy for a platform ────────────────────────────────────────────
  const handleGenerateCopy = async (platform) => {
    setGeneratingCopy(prev => ({ ...prev, [platform]: true }))
    try {
      const data = await api('generate-copy', {
        productName, productType: 'tshirt',
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

  // ── Publish to social platform ───────────────────────────────────────────────
  const handlePublish = async (platform) => {
    setPublishing(prev => ({ ...prev, [platform]: true }))
    setPublishMsgs(prev => ({ ...prev, [platform]: '' }))
    setConnectInfo(prev => ({ ...prev, [platform]: null }))
    try {
      const plat = personaPrompts[platform] || {}
      const doneAssets = [...(plat.image || []), ...(plat.video || [])]
        .map(t => ({ id: t.id, ...results[t.id] }))
        .filter(r => r.status === 'done' && (r.imageUrl || r.videoUrl))

      if (doneAssets.length === 0) throw new Error('Nessun asset pronto — genera prima')

      const copy = platformCopy[platform] || {}

      const preferVideo = platform === 'tiktok' || platform === 'youtube'
      const videoAsset  = doneAssets.find(a => a.videoUrl)
      const imageAsset  = doneAssets.find(a => a.imageUrl)
      const best        = preferVideo ? (videoAsset || imageAsset) : (imageAsset || videoAsset)

      const payload = {
        password:    ADMIN_PASSWORD,
        imageUrl:    best?.imageUrl || null,
        videoUrl:    best?.videoUrl || null,
        caption:     copy.caption       || `${persona.name} × JAYL`,
        hashtags:    copy.hashtags      || '#JAYL #style',
        altText:     copy.altText       || '',
        title:       copy.seoTitle      || productName,
        description: copy.seoDescription || '',
      }

      const res  = await fetch(`/api/publish-${platform}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()

      if (data.needsConnect) {
        setConnectInfo(prev => ({ ...prev, [platform]: data }))
        setPublishMsgs(prev => ({ ...prev, [platform]: '🔗' }))
        setTimeout(() => setPublishMsgs(prev => ({ ...prev, [platform]: '' })), 5000)
        return
      }

      if (!data.ok) throw new Error(data.error || 'Publish failed')

      setPublishMsgs(prev => ({ ...prev, [platform]: '✓' }))
      setTimeout(() => setPublishMsgs(prev => ({ ...prev, [platform]: '' })), 3000)
    } catch (e) {
      setPublishMsgs(prev => ({ ...prev, [platform]: `⚠ ${e.message.slice(0, 40)}` }))
      setTimeout(() => setPublishMsgs(prev => ({ ...prev, [platform]: '' })), 4000)
    } finally {
      setPublishing(prev => ({ ...prev, [platform]: false }))
    }
  }

  // ── PromptCard shared props ─────────────────────────────────────────────────
  const promptCardProps = (t, platform, isVideo) => ({
    template:         t,
    isVideo,
    promptText:       localPrompts[t.id] ?? t.prompt ?? '',
    onPromptChange:   val => setLocalPrompts(prev => ({ ...prev, [t.id]: val })),
    result:           results[t.id],
    onGenerate:       () => isVideo ? handleGenerateVideo(t.id) : handleGenerateImage(t.id),
    onSave:           (url, type) => handleSaveAsset(t.id, url, type),
    onSavePrompt:     () => handleSavePrompt(t.id, platform, isVideo),
    savingPrompt:     savingPrompts[t.id],
    savedPromptMsg:   savedMsgs[t.id],
    images:           combinedImages,
    extraRefs:        promptSettings[t.id]?.extraRefs || [],
    onAddExtraRef:    ref => handleAddExtraRef(t.id, ref),
    onRemoveExtraRef: url => handleRemoveExtraRef(t.id, url),
    selectedImage:    getSelectedImage(t.id),
    onSelectImage:    img => setSelectedImages(prev => ({ ...prev, [t.id]: img })),
    activeModel:      promptSettings[t.id]?.modelId || null,
    activeSize:       promptSettings[t.id]?.imageSize || null,
    onModelChange:    val => setPromptSettings(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), modelId: val } })),
    onSizeChange:     val => setPromptSettings(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), imageSize: val } })),
    models:           isVideo ? VIDEO_MODELS : IMAGE_MODELS,
    imageSizes:       IMAGE_SIZES,
    onDelete:         () => handleDeletePrompt(t.id, platform, isVideo),
  })

  const selectedVideoModel = VIDEO_MODELS.find(m => m.id === videoModel)
  const platData = personaPrompts[activePlatform] || { image: [], video: [] }
  const platMeta = SOCIAL_META[activePlatform]

  const getDoneCount = (platform) => {
    const plat = personaPrompts[platform] || {}
    return [...(plat.image || []), ...(plat.video || [])]
      .filter(t => results[t.id]?.status === 'done').length
  }

  return (
    <div className="border-t border-indigo-900/40 bg-gray-950/40">

      {/* Persona info header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-800">
        {persona.referenceImages?.[0] ? (
          <img src={toAbsoluteUrl(persona.referenceImages[0])} alt={persona.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-indigo-700 flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-900/50 border-2 border-indigo-700 flex items-center justify-center text-indigo-400 text-lg flex-shrink-0">
            {persona.name[0]}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-indigo-200 text-sm font-semibold">{persona.name}
            <span className="text-indigo-500 text-xs font-normal ml-1.5">{persona.handle}</span>
          </p>
          {persona.promptContext && (
            <p className="text-gray-600 text-xs truncate">{persona.promptContext}</p>
          )}
        </div>
        {/* Reference images strip */}
        {combinedImages.length > 0 && (
          <div className="ml-auto flex gap-1 overflow-hidden">
            {combinedImages.slice(0, 5).map((img, i) => (
              <div key={img.url || i}
                className={`flex-shrink-0 w-7 h-7 border overflow-hidden ${img._isPersonaRef ? 'border-indigo-700' : 'border-gray-700'}`}
                title={img.name}>
                <img src={toAbsoluteUrl(img.url)} alt={img.name}
                  className="w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.opacity = '0.3' }} />
              </div>
            ))}
            {combinedImages.length > 5 && (
              <span className="text-gray-600 text-[10px] self-center ml-0.5">+{combinedImages.length - 5}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Platform tabs ────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-800 overflow-x-auto">
        {INFLUENCER_PLATFORMS.map(plat => {
          const meta     = SOCIAL_META[plat]
          const doneCount = getDoneCount(plat)
          const isActive = activePlatform === plat
          return (
            <button key={plat} onClick={() => setActivePlatform(plat)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? `border-current ${meta.color}`
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              <span>{meta.icon}</span>
              <span className="hidden sm:inline">{meta.label}</span>
              {doneCount > 0 && (
                <span className="text-emerald-400 text-[9px] font-bold">{doneCount}✓</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Platform workspace ───────────────────────────────────────────────── */}
      <div className="p-4 space-y-4">

        {/* Settings bar */}
        <div className="bg-gray-900 border border-gray-800 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-gray-600 text-xs w-14 flex-shrink-0">📸 Model</label>
            <select value={imageModel} onChange={e => setImageModel(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 focus:outline-none flex-1 min-w-0">
              {IMAGE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.badge ? `${m.badge} ` : ''}{m.label}</option>
              ))}
            </select>
            <div className="flex gap-1">
              {IMAGE_SIZES.slice(0, 4).map(s => (
                <button key={s.id} onClick={() => setImageSize(s.id)} title={s.desc}
                  className={`px-1.5 py-0.5 text-[10px] border transition-colors ${
                    imageSize === s.id ? 'border-indigo-500 text-indigo-300' : 'border-gray-700 text-gray-600 hover:border-gray-500'
                  }`}>{s.label}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-gray-600 text-xs w-14 flex-shrink-0">🎬 Model</label>
            <select value={videoModel} onChange={e => setVideoModel(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 focus:outline-none flex-1 min-w-0">
              {VIDEO_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.badge ? `${m.badge} ` : ''}{m.label}</option>
              ))}
            </select>
            <div className="flex gap-1 items-center">
              {['5', '10'].map(d => (
                <button key={d} onClick={() => setVideoDuration(d)}
                  className={`px-2 py-0.5 text-xs border transition-colors ${
                    videoDuration === d ? 'border-indigo-500 text-indigo-300' : 'border-gray-700 text-gray-600 hover:border-gray-500'
                  }`}>{d}s</button>
              ))}
              <span className="text-gray-600 text-[10px]">
                ≈${((selectedVideoModel?.secRate ?? 0) * parseFloat(videoDuration)).toFixed(3)}
              </span>
            </div>
          </div>
        </div>

        {/* Image prompts */}
        {platData.image.length > 0 && (
          <div className="space-y-3">
            <p className={`text-xs font-semibold ${platMeta.color}`}>📸 Immagini</p>
            {platData.image.map(t => (
              <PromptCard key={t.id} {...promptCardProps(t, activePlatform, false)} />
            ))}
          </div>
        )}

        {/* Video prompts */}
        {platData.video.length > 0 && (
          <div className="space-y-3">
            <p className={`text-xs font-semibold ${platMeta.color}`}>🎬 Video</p>
            {platData.video.map(t => (
              <PromptCard key={t.id} {...promptCardProps(t, activePlatform, true)} />
            ))}
          </div>
        )}

        {/* Add prompt buttons */}
        <div className="flex gap-2">
          <button onClick={() => handleAddPrompt(activePlatform, false)}
            className={`flex-1 py-1.5 text-xs border border-dashed transition-colors ${platMeta.activeBorder} ${platMeta.color} opacity-60 hover:opacity-100`}>
            + Immagine
          </button>
          <button onClick={() => handleAddPrompt(activePlatform, true)}
            className={`flex-1 py-1.5 text-xs border border-dashed transition-colors ${platMeta.activeBorder} ${platMeta.color} opacity-60 hover:opacity-100`}>
            + Video
          </button>
        </div>

        {/* Copy panel */}
        {platformCopy[activePlatform] ? (
          <InfluencerCopyPanel
            copy={platformCopy[activePlatform]}
            platform={activePlatform}
            generating={generatingCopy[activePlatform]}
            onRegenerate={() => handleGenerateCopy(activePlatform)}
          />
        ) : (
          <button onClick={() => handleGenerateCopy(activePlatform)}
            disabled={generatingCopy[activePlatform] || getDoneCount(activePlatform) === 0}
            className={`w-full py-2 text-xs border border-dashed transition-colors ${
              generatingCopy[activePlatform] || getDoneCount(activePlatform) === 0
                ? 'border-gray-800 text-gray-700 cursor-not-allowed'
                : `${platMeta.activeBorder} ${platMeta.color} hover:${platMeta.activeBg}`
            }`}>
            {generatingCopy[activePlatform] ? 'Generando copy…' : '✨ Genera caption e hashtag'}
          </button>
        )}

        {/* Connect info if needed */}
        {connectInfo[activePlatform] && (
          <ConnectBanner
            platform={activePlatform}
            info={connectInfo[activePlatform]}
            onDismiss={() => setConnectInfo(prev => ({ ...prev, [activePlatform]: null }))}
          />
        )}

        {/* Publish button */}
        {/* Static Tailwind classes for each platform */}
        {/* instagram=purple tiktok=pink pinterest=red facebook=blue */}
        <button
          onClick={() => handlePublish(activePlatform)}
          disabled={publishing[activePlatform] || getDoneCount(activePlatform) === 0}
          className={`w-full py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            publishing[activePlatform] || getDoneCount(activePlatform) === 0
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : activePlatform === 'instagram' ? 'bg-purple-700 hover:bg-purple-600 text-white cursor-pointer'
              : activePlatform === 'tiktok'    ? 'bg-pink-700 hover:bg-pink-600 text-white cursor-pointer'
              : activePlatform === 'pinterest' ? 'bg-red-700 hover:bg-red-600 text-white cursor-pointer'
              : 'bg-blue-700 hover:bg-blue-600 text-white cursor-pointer'
          }`}>
          {publishing[activePlatform]
            ? <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
            : publishMsgs[activePlatform]
              ? <span>{publishMsgs[activePlatform]}</span>
              : <><span>{platMeta.icon}</span><span>Pubblica su {platMeta.label}</span></>
          }
        </button>

      </div>
    </div>
  )
}

// ── Main InfluencerPanel ──────────────────────────────────────────────────────
export default function InfluencerPanel({ personas, productId, productName, allImages, onAssetSaved }) {
  const [selectedId, setSelectedId] = useState(null)
  const selectedPersona = personas.find(p => p.id === selectedId) ?? null

  if (!personas.length) {
    return (
      <div className="flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-950/60 flex items-center gap-2">
          <span className="text-indigo-400 text-xs">👤</span>
          <span className="text-indigo-300 text-xs font-mono uppercase tracking-widest font-semibold">Influencer</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <p className="text-gray-600 text-sm">Nessun influencer</p>
            <p className="text-gray-700 text-xs">Crea personas nel tab Personas</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">

      {/* Panel header */}
      <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-950/60 flex items-center gap-2">
        <span className="text-indigo-400 text-xs">👤</span>
        <span className="text-indigo-300 text-xs font-mono uppercase tracking-widest font-semibold">Influencer</span>
        <span className="text-gray-600 text-xs ml-auto">{personas.length} personas</span>
      </div>

      {/* Circles row */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex gap-4 flex-wrap">
          {personas.map(p => {
            const isSelected = selectedId === p.id
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(isSelected ? null : p.id)}
                className="flex flex-col items-center gap-1.5 group"
                title={`${p.name} ${p.handle || ''}`}
              >
                <div className={`relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${
                  isSelected
                    ? 'border-indigo-400 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-900/40'
                    : 'border-gray-700 hover:border-indigo-600 group-hover:shadow-md group-hover:shadow-indigo-900/20'
                }`}>
                  {p.referenceImages?.[0] ? (
                    <img
                      src={toAbsoluteUrl(p.referenceImages[0])}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      onError={e => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-full h-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 text-xl font-bold">
                      {p.name[0]}
                    </div>
                  )}
                  {isSelected && <div className="absolute inset-0 bg-indigo-500/10" />}
                </div>
                <span className={`text-xs font-medium transition-colors max-w-16 text-center leading-tight ${
                  isSelected ? 'text-indigo-300' : 'text-gray-500 group-hover:text-gray-300'
                }`}>
                  {p.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Workspace — expands below circles when one is selected */}
      {selectedPersona && (
        <InfluencerWorkspace
          key={selectedPersona.id}
          persona={selectedPersona}
          productId={productId}
          productName={productName}
          allImages={allImages}
          onAssetSaved={onAssetSaved}
        />
      )}

      {!selectedPersona && (
        <div className="px-4 py-6 text-center text-gray-700 text-xs">
          Clicca su un influencer per aprire il workspace
        </div>
      )}

    </div>
  )
}
