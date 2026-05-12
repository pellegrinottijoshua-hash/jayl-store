import { useState, useRef } from 'react'

// ── Compress/resize images before upload to avoid Vercel 4.5MB body limit ────
async function compressImageIfNeeded(file) {
  // Pass through non-images and small files unchanged
  if (!file.type.startsWith('image/') || file.size < 2 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = reject
      r.readAsDataURL(file)
    })
  }
  // Resize to max 1400px on the longest side, JPEG quality 0.85
  return new Promise((resolve, reject) => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(blobUrl)
      const MAX = 1400
      let w = img.naturalWidth, h = img.naturalHeight
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX }
        else        { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = blobUrl
  })
}
import { btnPrimary, btnGhost, IMAGE_MODELS, VIDEO_MODELS, IMAGE_SIZES, DESTINATION_META, toAbsoluteUrl, downloadAsset, api } from './constants'

// PromptCard — usato sia da SitoPanel che da InfluencerPanel
export default function PromptCard({
  template,
  productId,       // for reference uploads
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
  const [addMode,       setAddMode]       = useState(null) // null | 'file' | 'url'
  const [refInput,      setRefInput]      = useState('')
  const [uploading,     setUploading]     = useState(false)
  const [uploadError,   setUploadError]   = useState('')
  const refInputRef  = useRef(null)
  const fileInputRef = useRef(null)

  // Build allRefs:
  //  1. Deduplicate images[] by URL (Gelato colour variants can share a mockup URL)
  //  2. Collect external refs: items whose URL is NOT in images[].
  //     This includes both extraRefs AND selectedImage (when it's an external upload that
  //     has become the primary slot — if we don't include it here it vanishes from the strip).
  const imageUrlSet = new Set()
  const dedupedImages = []
  for (const img of (images || [])) {
    if (!imageUrlSet.has(img.url)) {
      imageUrlSet.add(img.url)
      dedupedImages.push(img)
    }
  }
  // Use a Map to deduplicate externals by URL while preserving insertion order
  const externalMap = new Map()
  if (selectedImage && !imageUrlSet.has(selectedImage.url)) {
    externalMap.set(selectedImage.url, { ...selectedImage, _isExternal: true })
  }
  for (const r of (extraRefs || [])) {
    if (!imageUrlSet.has(r.url) && !externalMap.has(r.url)) {
      externalMap.set(r.url, { ...r, _isExternal: true })
    }
  }
  const allRefs = [...dedupedImages, ...externalMap.values()]

  // ── Add ref via URL ──────────────────────────────────────────────────────
  const commitUrl = () => {
    const url = refInput.trim()
    if (!url) { setAddMode(null); return }
    const name = url.split('/').pop()?.split('?')[0] || 'External'
    onAddExtraRef?.({ url, name })
    setRefInput('')
    setAddMode(null)
  }

  // ── Add ref via file upload ──────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadError(''); setAddMode(null)
    try {
      // Compress large images to stay under Vercel's 4.5MB body limit
      const dataUrl = await compressImageIfNeeded(file)
      // Upload to server → permanent URL (Blob or GitHub)
      const res  = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:   'upload-reference',
          password: 'jaylpelle',
          filename: file.name,
          dataUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed')
      onAddExtraRef?.({ url: data.url, name: data.name || file.name })
    } catch (e) {
      setUploadError(e.message)
      setTimeout(() => setUploadError(''), 4000)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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

      {/* ── Inline size selector (image prompts only) ─────────────────────── */}
      {!isVideo && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-gray-700 text-[10px] uppercase tracking-wider flex-shrink-0">Size</span>
          {(imageSizes || IMAGE_SIZES).map(s => (
            <button key={s.id} onClick={() => onSizeChange(s.id === activeSize ? null : s.id)} title={s.desc}
              className={`px-2 py-0.5 text-xs border transition-colors ${
                activeSize === s.id
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30'
                  : 'border-gray-700 text-gray-500 hover:border-gray-400 hover:text-gray-300'
              }`}
            >{s.label}</button>
          ))}
          {activeSize && (
            <span className="text-gray-600 text-[10px]">
              {(imageSizes || IMAGE_SIZES).find(s => s.id === activeSize)?.desc}
            </span>
          )}
        </div>
      )}

      {/* Per-prompt model settings toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSettingsOpen(o => !o)}
          className="text-gray-600 hover:text-gray-400 text-xs flex items-center gap-1 transition-colors"
        >
          ⚙ <span>{settingsOpen ? 'Hide model' : 'Model'}</span>
          {activeModel && <span className="text-indigo-500 ml-0.5">●</span>}
        </button>
        {activeModel && (
          <span className="text-indigo-400/60 text-xs truncate max-w-32">
            {(models || IMAGE_MODELS).find(m => m.id === activeModel)?.label}
          </span>
        )}
      </div>

      {/* Per-prompt model settings panel */}
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
          <p className="text-gray-700 text-xs">
            💾 Select a reference below, then <strong className="text-gray-500">Save prompt</strong> to pin it.
          </p>
        </div>
      )}

      {/* Reference image strip — ordered slot selection ─────────────────────
          Click any unselected image → becomes the next slot (ref 1, 2, 3…)
          Click a selected image → removes it from the ordered selection
          Numbered gold badges show the current slot for each selected image   */}
      {(allRefs.length > 0 || onAddExtraRef) && (
        <div className="space-y-1.5">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex gap-1.5 overflow-x-auto pb-0.5 items-end" style={{ scrollbarWidth: 'thin' }}>
            {allRefs.map((img, i) => {
              // Build ordered selection: [selectedImage, ...extraRefs]
              const orderedSel = [selectedImage, ...(extraRefs || [])].filter(Boolean)
              const slot       = orderedSel.findIndex(r => r.url === img.url) + 1 // 1-based, 0 = not selected
              const isSelected = slot > 0

              const handleRefClick = () => {
                const isPrimary  = selectedImage?.url === img.url
                const extraIdx   = (extraRefs || []).findIndex(r => r.url === img.url)
                const isExtraRef = extraIdx !== -1

                if (isPrimary) {
                  // Was primary → promote first extra to primary, or clear selection
                  if ((extraRefs || []).length > 0) {
                    onSelectImage?.(extraRefs[0])
                    onRemoveExtraRef?.(extraRefs[0].url)
                  } else {
                    onSelectImage?.(null)  // clear — no selection, generation falls back to allImages[0]
                  }
                } else if (isExtraRef) {
                  // Was an extra ref → remove from selection
                  onRemoveExtraRef?.(img.url)
                } else {
                  // Not selected → add as next slot
                  if (!selectedImage) {
                    onSelectImage?.(img)          // becomes primary (slot 1)
                  } else {
                    onAddExtraRef?.(img)          // becomes slot 2, 3, 4…
                  }
                }
              }

              return (
                <div key={img.url || i} className="flex-shrink-0 relative group flex flex-col items-center gap-0.5">
                  <div className="relative">
                    <button onClick={handleRefClick} title={img.name}
                      className={`w-12 h-12 border-2 overflow-hidden transition-all block ${
                        isSelected
                          ? 'border-indigo-500 ring-1 ring-indigo-500/40'
                          : img._isPinned
                            ? 'border-yellow-700 ring-1 ring-yellow-600/40'
                            : img._isExternal
                              ? 'border-green-800 hover:border-green-600'
                              : 'border-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <img src={toAbsoluteUrl(img.url)} alt={img.name}
                        className="w-full h-full object-cover"
                        onError={e => { e.currentTarget.style.opacity = '0.3' }} />
                    </button>
                    {/* Slot number badge — shown on all selected images */}
                    {isSelected && (
                      <span className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center leading-none rounded-sm shadow">
                        {slot}
                      </span>
                    )}
                    {/* Remove button for external refs */}
                    {img._isExternal && (
                      <button
                        onClick={e => { e.stopPropagation(); onRemoveExtraRef?.(img.url) }}
                        title="Remove from pool"
                        className="absolute -top-1 -right-1 w-4 h-4 bg-gray-800 border border-gray-600 rounded-full text-gray-400 hover:text-red-400 hover:border-red-700 text-[9px] flex items-center justify-center leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                      >✕</button>
                    )}
                  </div>
                  {/* Position number for non-selected product images */}
                  {!img._isExternal && !isSelected && (
                    <span className="text-[9px] font-mono leading-none text-center" style={{ color: '#4b5563' }}>
                      {i + 1}
                    </span>
                  )}
                </div>
              )
            })}

            {/* Add reference button */}
            {onAddExtraRef && addMode === null && (
              <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                <button
                  onClick={() => setAddMode('choose')}
                  disabled={uploading}
                  className="w-12 h-12 border-2 border-dashed border-gray-700 hover:border-indigo-600 text-gray-600 hover:text-indigo-400 flex items-center justify-center text-lg transition-colors disabled:opacity-50"
                  title="Add reference image or video"
                >{uploading ? <span className="animate-spin text-sm">⟳</span> : '+'}</button>
                <span className="text-[9px] text-gray-700 font-mono">add</span>
              </div>
            )}
          </div>

          {/* Upload error */}
          {uploadError && (
            <p className="text-red-400 text-xs">⚠ {uploadError}</p>
          )}

          {/* Add-mode chooser */}
          {addMode === 'choose' && (
            <div className="bg-gray-950 border border-gray-700 p-2 space-y-1.5">
              <button
                onClick={() => { setAddMode(null); setTimeout(() => fileInputRef.current?.click(), 50) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors text-left"
              >
                <span>📁</span>
                <div>
                  <p className="font-medium">Upload file</p>
                  <p className="text-gray-500 text-[10px]">PNG, JPEG, WEBP, MP4 — saved permanently</p>
                </div>
              </button>
              <button
                onClick={() => { setAddMode('url'); setTimeout(() => refInputRef.current?.focus(), 50) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors text-left"
              >
                <span>🔗</span>
                <div>
                  <p className="font-medium">Paste URL</p>
                  <p className="text-gray-500 text-[10px]">https://… any public image URL</p>
                </div>
              </button>
              <button onClick={() => setAddMode(null)} className="w-full text-gray-600 hover:text-gray-400 text-xs py-1 transition-colors">Cancel</button>
            </div>
          )}

          {/* URL input mode */}
          {addMode === 'url' && (
            <div className="flex gap-1.5 items-center">
              <input
                ref={refInputRef}
                value={refInput}
                onChange={e => setRefInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitUrl(); if (e.key === 'Escape') { setAddMode(null); setRefInput('') } }}
                placeholder="https://… paste image URL"
                className="flex-1 bg-gray-800 border border-indigo-700 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-indigo-500 font-mono min-w-0"
              />
              <button onClick={commitUrl} className="bg-indigo-700 hover:bg-indigo-600 text-white text-xs px-2 py-1.5 transition-colors flex-shrink-0">Add</button>
              <button onClick={() => { setAddMode(null); setRefInput('') }} className="text-gray-600 hover:text-gray-400 text-xs px-1 transition-colors flex-shrink-0">✕</button>
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
