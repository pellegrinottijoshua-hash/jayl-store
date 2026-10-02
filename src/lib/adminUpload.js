import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

// Caricamento di immagini e video nella galleria di un prodotto (azione admin
// `upload-image`): compressione nel browser, poi base64. Usato dalla scheda
// prodotto (galleria "Importate") e dal "+" nella lista prodotti.

export const sanitizeFilename = name => name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9._-]/g, '')

export function fileToBase64(file) {
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
export function compressImage(file, maxMB = 3.2) {
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

// ── Video compression (ffmpeg.wasm single-threaded, no COOP/COEP needed) ─────
// Lazily loads the WASM core from CDN on first use.
let _ffmpeg = null
let _ffmpegLoading = false
let _ffmpegCallbacks = []

async function ensureFFmpeg(onLog) {
  if (_ffmpeg) return _ffmpeg
  if (_ffmpegLoading) {
    return new Promise((resolve, reject) => {
      _ffmpegCallbacks.push({ resolve, reject })
    })
  }
  _ffmpegLoading = true
  try {
    const ff = new FFmpeg()
    if (onLog) ff.on('log', ({ message }) => onLog(message))
    const baseURL = 'https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/esm'
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`,   'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    _ffmpeg = ff
    _ffmpegCallbacks.forEach(cb => cb.resolve(ff))
    return ff
  } catch (err) {
    _ffmpegCallbacks.forEach(cb => cb.reject(err))
    throw err
  } finally {
    _ffmpegLoading = false
    _ffmpegCallbacks = []
  }
}

export async function compressVideo(file, maxMB = 2.5, onProgress, onStatus) {
  if (!/\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(file.name)) return file
  if (file.size <= maxMB * 1024 * 1024) return file

  onStatus?.('Caricamento codec video…')
  const ff = await ensureFFmpeg()

  const ext   = file.name.match(/\.[^.]+$/)?.[0] ?? '.mp4'
  const inFile  = `input${ext}`
  const outFile = 'output.mp4'

  ff.on('progress', ({ progress }) => onProgress?.(Math.round(progress * 100)))

  onStatus?.('Compressione video…')
  await ff.writeFile(inFile, await fetchFile(file))
  await ff.exec([
    '-i', inFile,
    '-vf', 'scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '30',
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart',
    '-y', outFile,
  ])

  const data = await ff.readFile(outFile)
  await ff.deleteFile(inFile).catch(() => {})
  await ff.deleteFile(outFile).catch(() => {})
  ff.off('progress')

  const blob = new Blob([data.buffer], { type: 'video/mp4' })
  const baseName = file.name.replace(/\.[^.]+$/, '')
  const result   = new File([blob], `${baseName}.mp4`, { type: 'video/mp4' })

  onStatus?.(`Compresso: ${(result.size / 1024 / 1024).toFixed(1)} MB`)
  // Return compressed only if smaller
  return result.size < file.size ? result : file
}

/** Comprime e prepara un file per `upload-image`: { filename, dataUrl, isVideo }. */
export async function prepareProductAsset(raw, { onProgress, onStatus } = {}) {
  const isRawVideo = /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(raw.name)
  const file = isRawVideo ? await compressVideo(raw, 2.5, onProgress, onStatus) : await compressImage(raw)
  const filename = sanitizeFilename(file.name)
  return { filename, dataUrl: await fileToBase64(file), isVideo: /\.(mp4|mov|webm)$/i.test(filename) }
}
