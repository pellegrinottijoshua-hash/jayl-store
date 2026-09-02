import { useEffect, useRef, useState } from 'react'

function parts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  }
}
const pad = (n) => String(n).padStart(2, '0')

/** Countdown a una data ISO. Chiama onExpire una sola volta allo scadere. */
export default function DropCountdown({ to, label, onExpire, className = '' }) {
  const [left, setLeft] = useState(() => Date.parse(to) - Date.now())
  // Ricorda se onExpire è già scattato per questo `to`, così l'effetto qui sotto
  // può dipendere onestamente da [left, onExpire] senza rilanciarlo ogni secondo.
  const firedRef = useRef(false)

  useEffect(() => {
    setLeft(Date.parse(to) - Date.now())
    firedRef.current = false
    const id = setInterval(() => setLeft(Date.parse(to) - Date.now()), 1000)
    return () => clearInterval(id)
  }, [to])

  useEffect(() => {
    if (left <= 0 && onExpire && !firedRef.current) {
      firedRef.current = true
      onExpire()
    }
  }, [left, onExpire])

  // `to` is admin-edited (src/data/drop.js) — a malformed value (e.g. a space
  // instead of 'T') can parse in one engine and come back NaN in another
  // (Safari is strict about ISO 8601). Without this guard that renders
  // "NaN : NaN : NaN : NaN" and onExpire never fires, since NaN <= 0 is false.
  if (!to || Number.isNaN(Date.parse(to))) return null
  const { d, h, m, s } = parts(left)
  return (
    <span className={className}>
      {label ? `${label} ` : ''}{pad(d)} : {pad(h)} : {pad(m)} : {pad(s)}
    </span>
  )
}
