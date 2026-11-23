// La sigla di Zack: un solo <audio> per tutto il sito, col bottone
// nell'header accanto al carrello. Una voce alla volta: quando parte la
// sigla, la home spegne i video ('zk-song-start'); quando un video prende
// la voce, la home chiama stopSong().
import { useSyncExternalStore } from 'react'

const SRC = '/zack/audio/sigla.mp3'
let audio = null
let playing = false
const subs = new Set()
const set = (v) => { if (v !== playing) { playing = v; subs.forEach((f) => f()) } }

function el() {
  if (!audio) {
    audio = new Audio(SRC)
    audio.preload = 'none'
    audio.addEventListener('play', () => set(true))
    audio.addEventListener('pause', () => set(false))
    audio.addEventListener('ended', () => set(false))
  }
  return audio
}

export function toggleSong() {
  const a = el()
  if (playing) { a.pause(); return }
  window.dispatchEvent(new Event('zk-song-start'))
  a.play().catch(() => set(false))
}

export function stopSong() { if (audio && playing) audio.pause() }

export function useSongPlaying() {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f) },
    () => playing,
    () => false,
  )
}
