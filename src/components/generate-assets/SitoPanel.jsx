import { useState, useEffect, useCallback, useRef } from 'react'
import { generatePrompts as defaultPromptsStatic } from '@/data/generate-prompts'
import PromptCard from './PromptCard'
import {
  api, IMAGE_MODELS, VIDEO_MODELS, IMAGE_SIZES,
  subVars, toAbsoluteUrl, btnPrimary, btnGhost,
} from './constants'
import { SOCIAL_LINKS } from '@/data/social-links'

export default function SitoPanel({
  productId, productName, productType, primaryColor, collection,
  allImages, onAssetSaved,
}) {
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
  const [promptSettings,  setPromptSettings]  = useState({})
  const [selectedImages,  setSelectedImages]  = useState({})
  const [generatingAll,   setGeneratingAll]   = useState(false)
  const [allProgress,     setAllProgress]     = useState({ done: 0, total: 0 })
  const pollTimers = useRef({})

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

  const getSelectedImage = (templateId) => {
    if (selectedImages[templateId]) return selectedImages[templateId]
    const savedRef = promptSettings[templateId]?.referenceUrl
    if (savedRef) return { url: savedRef, name: 'Pinned', _isPinned: true }
    return allImages[0] ?? null
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        } catch (e) { console.warn('[sito-video-poll]', e.message) }
      }
      pollTimers.current[requestId] = setInterval(poll, 3000)
    } catch (e) {
      patchResult(templateId, { status: 'error', error: e.message })
    }
  }

  const handleGenerateAll = async (templates, isVideo) => {
    if (generatingAll || !templates.length) return
    setGeneratingAll(true)
    setAllProgress({ done: 0, total: templates.length })
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i]
      const r = results[t.id]
      const busy = r?.status === 'generating' || r?.status === 'submitting' || r?.status === 'processing'
      if (!busy) {
        if (isVideo) await handleGenerateVideo(t.id)
        else         await handleGenerateImage(t.id)
      }
      setAllProgress({ done: i + 1, total: templates.length })
    }
    setGeneratingAll(false)
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

  const handleSavePrompt = async (templateId, isVideoPrompt) => {
    if (!rawPrompts) return
    setSavingPrompts(prev => ({ ...prev, [templateId]: true }))
    setSavedPromptMsgs(prev => ({ ...prev, [templateId]: '' }))
    try {
      const category = isVideoPrompt ? 'video' : 'mockup'
      const ps       = promptSettings[templateId] || {}
      const selImg   = selectedImages[templateId] || null
      const updated  = {
        ...rawPrompts,
        [category]: (rawPrompts[category] || []).map(t => {
          if (t.id !== templateId) return t
          const extra = {}
          if (ps.modelId) extra[isVideoPrompt ? 'videoModelId' : 'modelId'] = ps.modelId
          if (ps.imageSize && !isVideoPrompt) extra.imageSize = ps.imageSize
          if (selImg?.url) extra.referenceUrl = selImg.url
          return { ...t, prompt: localPrompts[templateId] ?? t.prompt, ...extra }
        }),
      }
      await api('save-prompts', { prompts: updated })
      setRawPrompts(updated)
      setPromptSettings(prev => ({
        ...prev,
        [templateId]: {
          ...(prev[templateId] || {}),
          ...(ps.modelId   ? { modelId:      ps.modelId   } : {}),
          ...(ps.imageSize ? { imageSize:    ps.imageSize } : {}),
          ...(selImg?.url  ? { referenceUrl: selImg.url   } : {}),
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

  const prompts          = rawPrompts || defaultPromptsStatic
  const currentTemplates = activeTab === 'mockup' ? (prompts.mockup || []) : (prompts.video || [])
  const selectedVideoModel = VIDEO_MODELS.find(m => m.id === videoModel)

  // Site social links for publish
  const siteLinks = {
    instagram: SOCIAL_LINKS.instagram || null,
    tiktok:    SOCIAL_LINKS.tiktok    || null,
    pinterest: SOCIAL_LINKS.pinterest || null,
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-950/60 flex items-center gap-2">
        <span className="text-blue-400 text-xs">🌐</span>
        <span className="text-blue-300 text-xs font-mono uppercase tracking-widest font-semibold">Sito</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {[
          { id: 'mockup', label: '🖼 Mockup' },
          { id: 'video',  label: '🎬 Video'  },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === t.id ? 'border-blue-500 text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3 overflow-y-auto flex-1">

        {/* Settings bar */}
        <div className="bg-gray-900 border border-gray-800 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-gray-600 text-xs w-14 flex-shrink-0">Model</label>
            <select
              value={activeTab === 'mockup' ? imageModel : videoModel}
              onChange={e => activeTab === 'mockup' ? setImageModel(e.target.value) : setVideoModel(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 focus:outline-none focus:border-blue-500 flex-1 min-w-0"
            >
              {(activeTab === 'mockup' ? IMAGE_MODELS : VIDEO_MODELS).map(m => (
                <option key={m.id} value={m.id}>
                  {m.badge ? `${m.badge} ` : ''}{m.label}
                  {activeTab === 'mockup' ? ` — ${m.cost}` : ` — $${((m.secRate || 0) * parseFloat(videoDuration)).toFixed(3)}/${videoDuration}s`}
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
                      imageSize === s.id ? 'border-blue-500 text-blue-300 bg-blue-900/20' : 'border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}>{s.label}</button>
                ))}
                <span className="text-gray-600 text-xs self-center ml-1">
                  {IMAGE_SIZES.find(s => s.id === imageSize)?.desc}
                </span>
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
                      videoDuration === d ? 'border-blue-500 text-blue-300 bg-blue-900/20' : 'border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}>{d}s</button>
                ))}
                <span className="text-gray-600 text-xs ml-2">
                  ≈ ${((selectedVideoModel?.secRate ?? 0) * parseFloat(videoDuration)).toFixed(3)}
                </span>
              </div>
            </div>
          )}
        </div>

        {allImages.length === 0 && (
          <div className="bg-yellow-900/20 border border-yellow-800/50 px-3 py-2 text-yellow-400 text-xs">
            ⚠ No reference images. Import Gelato mockups first.
          </div>
        )}

        {currentTemplates.length > 1 && allImages.length > 0 && (
          <button
            onClick={() => handleGenerateAll(currentTemplates, activeTab === 'video')}
            disabled={generatingAll}
            className={`w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold tracking-wider uppercase border transition-colors ${
              generatingAll ? 'border-blue-800 text-blue-600 cursor-not-allowed' : 'border-blue-700 text-blue-300 hover:bg-blue-900/20'
            }`}
          >
            {generatingAll
              ? <><span className="animate-spin w-3 h-3 border border-blue-400 border-t-transparent rounded-full inline-block" /> Generating {allProgress.done}/{allProgress.total}…</>
              : <>{activeTab === 'video' ? '🎬' : '🖼'} Generate All ({currentTemplates.length})</>
            }
          </button>
        )}

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
              showPublish
              publishLinks={siteLinks}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
