import { useState, useRef } from 'react'
import { btnPrimary, btnGhost, IMAGE_MODELS, VIDEO_MODELS, IMAGE_SIZES, DESTINATION_META, toAbsoluteUrl, downloadAsset } from './constants'

// PromptCard — usato sia da SitoPanel che da InfluencerPanel
export default function PromptCard({
  template,
  isVideo,
  promptText,
  onPromptChange,
  result,
  onGenerate,
  onSave,
  onSavePrompt,
  savingPrompt,
  savedPromptMsg,
  images,
  extraRefs,       // [{ url, name }] — external reference images per-prompt
  onAddExtraRef,   // (ref: { url, name }) => void
  onRemoveExtraRef,// (url: string) => void
  selectedImage,
  onSelectImage,
  activeModel,
  activeSize,
  onModelChange,
  onSizeChange,
  models,
  imageSizes,
  onDelete,          // optional — shows ✕ button (influencer prompts)
  showPublish,       // optional — show inline social publish buttons
  publishLinks,      // optional — { instagram, tiktok, youtube, pinterest }
}) {
  const r    = result || {}
  const busy = r.status === 'generating' || r.status === 'submitting' || r.status === 'processing'
  const [settingsOpen,  setSettingsOpen]  = useState(false)
  const [publishCopied, setPublishCopied] = useState('')
  const [addingRef,     setAddingRef]     = useState(false)
  const [refInput,      setRefInput]      = useState('')
  const refInputRef = useRef(null)

  const allRefs = [
    ...(images || []),
    ...(extraRefs || []).map(r => ({ ...r, _isExternal: true })),
  ]

  const commitRef = () => {
    const url = refInput.trim()
    if (!url) { setAddingRef(false); return }
    const name = url.split('/').pop()?.split('?')[0] || 'External'
    onAddExtraRef?.({ url, name })
    setRefInput('')
    setAddingRef(false)
  }

  const destination = template.destination
  const destMeta    = destination ? DESTINATION_META[destination] : null

  const handlePublish = async (platform, url) => {
    const caption = r.caption || ''
    try { await navigator.clipboard.writeText(caption) } catch {}
    setPublishCopied(platform)
    setTimeout(() => setPublishCopied(''), 2500)
    window.open(url, '_blank', 'noopener noreferrer')
  }

  return (
    <div className="bg-gray-900 border border-gray-800 p-4 space-y-3">

      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {destMeta && (
            <span className={`text-sm flex-shrink-0 ${destMeta.color}`} title={destMeta.label}>
              {destMeta.icon}
            </span>
          )}
          <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider truncate">{template.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {savedPromptMsg && (
            <span className={`text-xs ${savedPromptMsg.startsWith('✓') ? 'text-green-400' : 'text-yellow-400'}`}>
              {savedPromptMsg}
            </span>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-gray-600 hover:text-red-400 text-xs transition-colors px-1"
              title="Delete this prompt"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Per-prompt settings toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSettingsOpen(o => !o)}
          className="text-gray-600 hover:text-gray-400 text-xs flex items-center gap-1 transition-colors"
        >
          ⚙ <span>{settingsOpen ? 'Hide' : 'Settings'}</span>
          {(activeModel || activeSize) && <span className="text-indigo-500 ml-0.5">●</span>}
        </button>
        {activeModel && (
          <span className="text-indigo-400/60 text-xs truncate max-w-32">
            {(models || IMAGE_MODELS).find(m => m.id === activeModel)?.label}
          </span>
        )}
      </div>

      {/* Per-prompt settings panel */}
      {settingsOpen && (
        <div className="bg-gray-950 border border-gray-700/50 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-xs w-12 flex-shrink-0">Model</span>
            <select
              value={activeModel || ''}
              onChange={e => onModelChange(e.target.value || null)}
              className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 flex-1 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Global default —</option>
              {(models || (isVideo ? VIDEO_MODELS : IMAGE_MODELS)).map(m => (
                <option key={m.id} value={m.id}>
                  {m.badge ? `${m.badge} ` : ''}{m.label}
                </option>
              ))}
            </select>
          </div>
          {!isVideo && (
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-xs w-12 flex-shrink-0">Size</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => onSizeChange(null)}
                  className={`px-2 py-0.5 text-xs border transition-colors ${
                    !activeSize ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-gray-700 text-gray-600 hover:border-gray-500'
                  }`}
                >default</button>
                {(imageSizes || IMAGE_SIZES).map(s => (
                  <button key={s.id} onClick={() => onSizeChange(s.id)} title={s.desc}
                    className={`px-2 py-0.5 text-xs border transition-colors ${
                      activeSize === s.id
                        ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30'
                        : 'border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}
                  >{s.label}</button>
                ))}
              </div>
            </div>
          )}
          <p className="text-gray-700 text-xs">
            💾 Select a reference below, then <strong className="text-gray-500">Save prompt</strong> to pin it.
          </p>
        </div>
      )}

      {/* Reference image strip — product images + external refs */}
      {(allRefs.length > 0 || onAddExtraRef) && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 items-center" style={{ scrollbarWidth: 'thin' }}>
            {allRefs.map((img, i) => {
              const isSel = selectedImage ? selectedImage.url === img.url : i === 0
              return (
                <div key={img.url || i} className="flex-shrink-0 relative group">
                  <button onClick={() => onSelectImage(img)} title={img.name}
                    className={`w-12 h-12 border-2 overflow-hidden transition-all block ${
                      isSel ? 'border-indigo-500 ring-1 ring-indigo-500/40' : 'border-gray-700 hover:border-gray-500'
                    } ${img._isPinned ? 'border-yellow-700 ring-1 ring-yellow-600/40' : ''}`}
                  >
                    <img src={toAbsoluteUrl(img.url)} alt={img.name}
                      className="w-full h-full object-cover"
                      onError={e => { e.currentTarget.style.opacity = '0.3' }} />
                  </button>
                  {/* External badge + remove */}
                  {img._isExternal && (
                    <button
                      onClick={() => onRemoveExtraRef?.(img.url)}
                      title="Remove external ref"
                      className="absolute -top-1 -right-1 w-4 h-4 bg-gray-800 border border-gray-600 rounded-full text-gray-400 hover:text-red-400 hover:border-red-700 text-[9px] flex items-center justify-center leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                    >✕</button>
                  )}
                  {img._isExternal && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-gray-400 text-center leading-tight py-0.5 pointer-events-none">
                      ext
                    </span>
                  )}
                </div>
              )
            })}

            {/* Add external ref button */}
            {onAddExtraRef && !addingRef && (
              <button
                onClick={() => { setAddingRef(true); setTimeout(() => refInputRef.current?.focus(), 50) }}
                className="flex-shrink-0 w-12 h-12 border-2 border-dashed border-gray-700 hover:border-indigo-600 text-gray-600 hover:text-indigo-400 flex items-center justify-center text-lg transition-colors"
                title="Add external reference URL"
              >+</button>
            )}
          </div>

          {/* Inline URL input */}
          {addingRef && (
            <div className="flex gap-1.5 items-center">
              <input
                ref={refInputRef}
                value={refInput}
                onChange={e => setRefInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRef(); if (e.key === 'Escape') { setAddingRef(false); setRefInput('') } }}
                placeholder="https://… paste image URL"
                className="flex-1 bg-gray-800 border border-indigo-700 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-indigo-500 font-mono min-w-0"
              />
              <button onClick={commitRef} className="bg-indigo-700 hover:bg-indigo-600 text-white text-xs px-2 py-1.5 transition-colors flex-shrink-0">Add</button>
              <button onClick={() => { setAddingRef(false); setRefInput('') }} className="text-gray-600 hover:text-gray-400 text-xs px-1 transition-colors flex-shrink-0">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Prompt textarea */}
      <textarea
        value={promptText ?? ''}
        onChange={e => onPromptChange(e.target.value)}
        rows={3}
        className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs px-3 py-2 resize-none focus:outline-none focus:border-indigo-500 transition-colors font-mono"
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onGenerate} disabled={busy}
          className={`${btnPrimary} text-xs py-1.5 flex items-center gap-2`}>
          {busy ? (
            <>
              <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full flex-shrink-0" />
              {r.status === 'processing' ? `${r.progress ?? 0}%…` : r.status === 'submitting' ? 'Submitting…' : 'Generating…'}
            </>
          ) : (isVideo ? '🎬 Generate' : '🖼 Generate')}
        </button>
        <button onClick={onSavePrompt} disabled={savingPrompt}
          className={`${btnGhost} text-xs py-1`} title="Save as default template">
          {savingPrompt ? '…' : '💾 Save prompt'}
        </button>
      </div>

      {/* Video progress */}
      {isVideo && (r.status === 'submitting' || r.status === 'processing') && (
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${r.progress ?? 5}%` }} />
        </div>
      )}

      {/* Error */}
      {r.status === 'error' && r.error && (
        <p className="text-red-400 text-xs">⚠ {r.error}</p>
      )}

      {/* Image result */}
      {!isVideo && r.imageUrl && (
        <div className="space-y-2">
          <img src={r.imageUrl} alt="Generated"
            className="w-full border border-gray-700"
            style={{ maxHeight: 260, objectFit: 'contain', background: '#111' }} />
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => onSave(r.imageUrl, 'image')} disabled={r.saving || r.saved}
              className={`${btnPrimary} text-xs py-1 px-3`}>
              {r.saving ? 'Saving…' : r.saved ? '✓ Saved' : '💾 Save'}
            </button>
            <button onClick={() => downloadAsset(r.imageUrl, `${template.id}.jpg`)}
              className={`${btnGhost} text-xs py-1`}>⬇ Download</button>
            <button onClick={onGenerate} disabled={busy} className={`${btnGhost} text-xs py-1`}>↻ Regen</button>
          </div>
          {/* Inline publish buttons */}
          {showPublish && publishLinks && (
            <div className="flex gap-1.5 flex-wrap pt-1 border-t border-gray-800">
              {publishLinks.instagram && (
                <button onClick={() => handlePublish('instagram', publishLinks.instagram)}
                  className={`${btnGhost} text-xs py-1 flex items-center gap-1 ${publishCopied === 'instagram' ? 'text-pink-400 border-pink-800' : ''}`}>
                  📸 {publishCopied === 'instagram' ? 'Copied!' : 'Instagram'}
                </button>
              )}
              {publishLinks.tiktok && (
                <button onClick={() => handlePublish('tiktok', publishLinks.tiktok)}
                  className={`${btnGhost} text-xs py-1 flex items-center gap-1 ${publishCopied === 'tiktok' ? 'text-gray-200 border-gray-500' : ''}`}>
                  🎵 {publishCopied === 'tiktok' ? 'Copied!' : 'TikTok'}
                </button>
              )}
              {publishLinks.pinterest && (
                <button onClick={() => handlePublish('pinterest', publishLinks.pinterest)}
                  className={`${btnGhost} text-xs py-1 flex items-center gap-1 ${publishCopied === 'pinterest' ? 'text-red-400 border-red-800' : ''}`}>
                  📌 {publishCopied === 'pinterest' ? 'Copied!' : 'Pinterest'}
                </button>
              )}
              {publishLinks.youtube && (
                <button onClick={() => handlePublish('youtube', publishLinks.youtube)}
                  className={`${btnGhost} text-xs py-1 flex items-center gap-1 ${publishCopied === 'youtube' ? 'text-red-400 border-red-700' : ''}`}>
                  ▶ {publishCopied === 'youtube' ? 'Copied!' : 'YouTube'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Video result */}
      {isVideo && r.videoUrl && (
        <div className="space-y-2">
          <video src={r.videoUrl} controls className="w-full border border-gray-700" style={{ maxHeight: 220 }} />
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={() => onSave(r.videoUrl, 'video')} disabled={r.saving || r.saved}
              className={`${btnPrimary} text-xs py-1 px-3`}>
              {r.saving ? 'Saving…' : r.saved ? '✓ Saved' : '💾 Save'}
            </button>
            <button onClick={() => downloadAsset(r.videoUrl, `${template.id}.mp4`)}
              className={`${btnGhost} text-xs py-1`}>⬇ Download</button>
            <button onClick={onGenerate} disabled={busy} className={`${btnGhost} text-xs py-1`}>↻ Regen</button>
            <a href={r.videoUrl} target="_blank" rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 text-xs underline">Open ↗</a>
          </div>
          {showPublish && publishLinks && (
            <div className="flex gap-1.5 flex-wrap pt-1 border-t border-gray-800">
              {publishLinks.tiktok && (
                <button onClick={() => handlePublish('tiktok', publishLinks.tiktok)}
                  className={`${btnGhost} text-xs py-1`}>
                  🎵 {publishCopied === 'tiktok' ? 'Copied!' : 'TikTok'}
                </button>
              )}
              {publishLinks.youtube && (
                <button onClick={() => handlePublish('youtube', publishLinks.youtube)}
                  className={`${btnGhost} text-xs py-1`}>
                  ▶ {publishCopied === 'youtube' ? 'Copied!' : 'YouTube'}
                </button>
              )}
              {publishLinks.instagram && (
                <button onClick={() => handlePublish('instagram', publishLinks.instagram)}
                  className={`${btnGhost} text-xs py-1`}>
                  📸 {publishCopied === 'instagram' ? 'Copied!' : 'Instagram'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
