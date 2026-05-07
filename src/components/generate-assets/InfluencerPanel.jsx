import { useState, useEffect, useRef } from 'react'
import PromptCard from './PromptCard'
import {
  api, IMAGE_MODELS, VIDEO_MODELS, IMAGE_SIZES,
  toAbsoluteUrl, btnPrimary, btnGhost,
} from './constants'

// Default empty prompts for a new influencer
function defaultInfluencerPrompts(persona) {
  const ctx = persona.promptContext || persona.aesthetic || ''
  return {
    mockup: [
      {
        id: `${persona.id}-img-1`,
        name: 'Street Shot',
        prompt: ctx ? `${ctx} — wearing the product, editorial street photography` : 'Editorial street photography wearing the product',
        destination: 'instagram',
      },
      {
        id: `${persona.id}-img-2`,
        name: 'Studio Clean',
        prompt: ctx ? `${ctx} — clean studio portrait with product, minimal background` : 'Clean studio portrait with product',
        destination: 'site',
      },
    ],
    video: [
      {
        id: `${persona.id}-vid-1`,
        name: 'Lifestyle Reel',
        prompt: ctx ? `${ctx} — lifestyle video wearing the product, energetic movement` : 'Lifestyle video wearing the product',
        destination: 'instagram',
      },
    ],
  }
}

function InfluencerWorkspace({
  persona, productId, productName, allImages, onAssetSaved,
}) {
  const [activeTab,      setActiveTab]      = useState('mockup')
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
  const pollTimers = useRef({})

  // Prompts stored in persona.prompts or use defaults
  const [personaPrompts, setPersonaPrompts] = useState(
    persona.prompts && (persona.prompts.mockup?.length || persona.prompts.video?.length)
      ? persona.prompts
      : defaultInfluencerPrompts(persona)
  )

  useEffect(() => {
    // Reset when persona changes
    const prompts = persona.prompts && (persona.prompts.mockup?.length || persona.prompts.video?.length)
      ? persona.prompts
      : defaultInfluencerPrompts(persona)
    setPersonaPrompts(prompts)
    const local    = {}
    const settings = {}
    for (const t of [...(prompts.mockup || []), ...(prompts.video || [])]) {
      local[t.id] = t.prompt || ''
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
    setResults({})
    setSelectedImages({})
  }, [persona.id]) // eslint-disable-line

  useEffect(() => () => { Object.values(pollTimers.current).forEach(clearInterval) }, [])

  const patchResult = (id, patch) =>
    setResults(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))

  // Reference images: influencer's own refs first, then product images
  const influencerRefs = (persona.referenceImages || []).map((url, i) => ({
    url,
    name: `${persona.name} ref ${i + 1}`,
    _isPersonaRef: true,
  }))
  const combinedImages = [...influencerRefs, ...allImages]

  const getSelectedImage = (templateId) => {
    if (selectedImages[templateId]) return selectedImages[templateId]
    const savedRef = promptSettings[templateId]?.referenceUrl
    if (savedRef) return { url: savedRef, name: 'Pinned', _isPinned: true }
    // Default to influencer's first ref if available, else product image
    return influencerRefs[0] ?? allImages[0] ?? null
  }

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
            const rRes = await fetch('/api/generate-video', {
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

  const savePersonaPrompts = async (prompts) => {
    await api('save-persona-prompts', { personaId: persona.id, prompts })
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

  const handleSavePrompt = async (templateId, isVideoPrompt) => {
    setSavingPrompts(prev => ({ ...prev, [templateId]: true }))
    setSavedMsgs(prev => ({ ...prev, [templateId]: '' }))
    try {
      const category = isVideoPrompt ? 'video' : 'mockup'
      const ps       = promptSettings[templateId] || {}
      const selImg   = selectedImages[templateId] || null
      const updatedPrompts = {
        ...personaPrompts,
        [category]: (personaPrompts[category] || []).map(t => {
          if (t.id !== templateId) return t
          const extra = {}
          if (ps.modelId) extra[isVideoPrompt ? 'videoModelId' : 'modelId'] = ps.modelId
          if (ps.imageSize && !isVideoPrompt) extra.imageSize = ps.imageSize
          if (selImg?.url) extra.referenceUrl = selImg.url
          if (ps.extraRefs?.length) extra.extraRefs = ps.extraRefs
          return { ...t, prompt: localPrompts[templateId] ?? t.prompt, ...extra }
        }),
      }
      await savePersonaPrompts(updatedPrompts)
      setPersonaPrompts(updatedPrompts)
      setSavedMsgs(prev => ({ ...prev, [templateId]: '✓ Saved' }))
      setTimeout(() => setSavedMsgs(prev => ({ ...prev, [templateId]: '' })), 2500)
    } catch (e) {
      setSavedMsgs(prev => ({ ...prev, [templateId]: '⚠ Error' }))
    } finally {
      setSavingPrompts(prev => ({ ...prev, [templateId]: false }))
    }
  }

  const handleAddPrompt = (isVideo) => {
    const id       = `${persona.id}-${isVideo ? 'vid' : 'img'}-${Date.now()}`
    const category = isVideo ? 'video' : 'mockup'
    const newPrompt = { id, name: 'New prompt', prompt: '', destination: 'instagram' }
    setPersonaPrompts(prev => ({
      ...prev,
      [category]: [...(prev[category] || []), newPrompt],
    }))
    setLocalPrompts(prev => ({ ...prev, [id]: '' }))
  }

  const handleDeletePrompt = async (templateId, isVideo) => {
    const category = isVideo ? 'video' : 'mockup'
    const updatedPrompts = {
      ...personaPrompts,
      [category]: (personaPrompts[category] || []).filter(t => t.id !== templateId),
    }
    try {
      await savePersonaPrompts(updatedPrompts)
      setPersonaPrompts(updatedPrompts)
    } catch {
      // Optimistic: update local even if save fails
      setPersonaPrompts(updatedPrompts)
    }
  }

  const currentTemplates = activeTab === 'mockup'
    ? (personaPrompts.mockup || [])
    : (personaPrompts.video  || [])

  const selectedVideoModel = VIDEO_MODELS.find(m => m.id === videoModel)

  const publishLinks = {
    instagram: persona.instagram || null,
    tiktok:    persona.tiktok    || null,
    youtube:   persona.youtube   || null,
  }

  return (
    <div className="border-t border-indigo-900/40 bg-gray-950/40">
      {/* Influencer info header */}
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
      </div>

      {/* Reference images strip */}
      {combinedImages.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-800">
          <p className="text-gray-600 text-xs mb-1.5">References</p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'thin' }}>
            {combinedImages.map((img, i) => (
              <div key={img.url || i}
                className={`flex-shrink-0 w-10 h-10 border overflow-hidden ${
                  img._isPersonaRef ? 'border-indigo-700' : 'border-gray-700'
                }`}
                title={img.name}
              >
                <img src={toAbsoluteUrl(img.url)} alt={img.name}
                  className="w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.opacity = '0.3' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {[{ id: 'mockup', label: '🖼 Mockup' }, { id: 'video', label: '🎬 Video' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === t.id ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>{t.label}</button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {/* Settings bar */}
        <div className="bg-gray-900 border border-gray-800 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-gray-600 text-xs w-14 flex-shrink-0">Model</label>
            <select
              value={activeTab === 'mockup' ? imageModel : videoModel}
              onChange={e => activeTab === 'mockup' ? setImageModel(e.target.value) : setVideoModel(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 focus:outline-none focus:border-indigo-500 flex-1 min-w-0"
            >
              {(activeTab === 'mockup' ? IMAGE_MODELS : VIDEO_MODELS).map(m => (
                <option key={m.id} value={m.id}>
                  {m.badge ? `${m.badge} ` : ''}{m.label}
                </option>
              ))}
            </select>
          </div>
          {activeTab === 'mockup' && (
            <div className="flex items-center gap-2">
              <label className="text-gray-600 text-xs w-14 flex-shrink-0">Size</label>
              <div className="flex gap-1 flex-wrap">
                {IMAGE_SIZES.map(s => (
                  <button key={s.id} onClick={() => setImageSize(s.id)} title={s.desc}
                    className={`px-2 py-0.5 text-xs border transition-colors ${
                      imageSize === s.id ? 'border-indigo-500 text-indigo-300 bg-indigo-900/20' : 'border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}>{s.label}</button>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'video' && (
            <div className="flex items-center gap-2">
              <label className="text-gray-600 text-xs w-14 flex-shrink-0">Duration</label>
              <div className="flex gap-1 items-center">
                {['5', '10'].map(d => (
                  <button key={d} onClick={() => setVideoDuration(d)}
                    className={`px-3 py-0.5 text-xs border transition-colors ${
                      videoDuration === d ? 'border-indigo-500 text-indigo-300 bg-indigo-900/20' : 'border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}>{d}s</button>
                ))}
                <span className="text-gray-600 text-xs ml-2">
                  ≈ ${((selectedVideoModel?.secRate ?? 0) * parseFloat(videoDuration)).toFixed(3)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Prompt cards */}
        <div className="space-y-4">
          {currentTemplates.map(t => (
            <PromptCard
              key={t.id}
              template={t}
              isVideo={activeTab === 'video'}
              promptText={localPrompts[t.id] ?? t.prompt ?? ''}
              onPromptChange={val => setLocalPrompts(prev => ({ ...prev, [t.id]: val }))}
              result={results[t.id]}
              onGenerate={() => activeTab === 'video' ? handleGenerateVideo(t.id) : handleGenerateImage(t.id)}
              onSave={(url, type) => handleSaveAsset(t.id, url, type)}
              onSavePrompt={() => handleSavePrompt(t.id, activeTab === 'video')}
              savingPrompt={savingPrompts[t.id]}
              savedPromptMsg={savedMsgs[t.id]}
              images={combinedImages}
              extraRefs={promptSettings[t.id]?.extraRefs || []}
              onAddExtraRef={ref => handleAddExtraRef(t.id, ref)}
              onRemoveExtraRef={url => handleRemoveExtraRef(t.id, url)}
              selectedImage={getSelectedImage(t.id)}
              onSelectImage={img => setSelectedImages(prev => ({ ...prev, [t.id]: img }))}
              activeModel={promptSettings[t.id]?.modelId || null}
              activeSize={promptSettings[t.id]?.imageSize || null}
              onModelChange={val => setPromptSettings(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), modelId: val } }))}
              onSizeChange={val => setPromptSettings(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), imageSize: val } }))}
              models={activeTab === 'mockup' ? IMAGE_MODELS : VIDEO_MODELS}
              imageSizes={IMAGE_SIZES}
              onDelete={() => handleDeletePrompt(t.id, activeTab === 'video')}
              showPublish
              publishLinks={publishLinks}
            />
          ))}
        </div>

        {/* Add prompt button */}
        <button
          onClick={() => handleAddPrompt(activeTab === 'video')}
          className="w-full py-2 text-xs border border-dashed border-indigo-800 text-indigo-600 hover:text-indigo-400 hover:border-indigo-600 transition-colors"
        >
          + Add {activeTab === 'video' ? 'video' : 'image'} prompt
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
      <div className="flex flex-col h-full">
        <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-950/60 flex items-center gap-2">
          <span className="text-indigo-400 text-xs">👤</span>
          <span className="text-indigo-300 text-xs font-mono uppercase tracking-widest font-semibold">Influencer</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <p className="text-gray-600 text-sm">No influencers yet</p>
            <p className="text-gray-700 text-xs">Create personas in the Personas tab first</p>
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
                title={`${p.name} ${p.handle}`}
              >
                {/* Circle avatar */}
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
                  {isSelected && (
                    <div className="absolute inset-0 bg-indigo-500/10" />
                  )}
                </div>
                {/* Name */}
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
          Click an influencer to open their workspace
        </div>
      )}
    </div>
  )
}
