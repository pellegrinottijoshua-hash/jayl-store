import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Il tempo del drop senza numeri: la scia dorata della piuma di Zack the Duck,
 * che si consuma man mano che il prezzo di lancio scade. Piena all'apertura,
 * sparisce alla chiusura; la testa luminosa e' il punto in cui sta bruciando.
 *
 * Le parole arrivano solo alla fine: "last call" nelle ultime 12 ore,
 * "almost gone" nell'ultima ora. Prima la linea basta da sola.
 */
const LAST_CALL_MS   = 12 * 3600 * 1000
const ALMOST_GONE_MS = 1 * 3600 * 1000

// Un'onda morbida, come i nastri di luce della piuma.
const PATH = 'M2 12 C 30 1, 52 23, 80 12 S 130 1, 158 12 S 208 23, 238 12'

export default function GoldenTrail({ startsAt, endsAt, className = '', width = 'min(240px, 60vw)' }) {
  const reduce = useReducedMotion()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => clearInterval(id)
  }, [])

  const start = Date.parse(startsAt)
  const end   = Date.parse(endsAt)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null

  const left = end - now
  if (left <= 0) return null
  const f = Math.min(1, Math.max(0.015, left / (end - start)))
  const word = left <= ALMOST_GONE_MS ? 'almost gone' : left <= LAST_CALL_MS ? 'last call' : null

  return (
    <div className={`flex flex-col items-center ${className}`} aria-label={word || 'launch price running'}>
      <svg viewBox="0 0 240 24" style={{ width, height: 'auto', overflow: 'visible' }} aria-hidden>
        <defs>
          <linearGradient id="jayl-trail" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#A8873F" />
            <stop offset="1" stopColor="#E8C878" />
          </linearGradient>
          <filter id="jayl-trail-glow" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        {/* Dove la scia e' gia' passata: appena un'ombra. */}
        <path d={PATH} pathLength="1" fill="none" stroke="#C4A35A" strokeOpacity="0.1" strokeWidth="1" />

        {/* Alone + nastro: la parte che resta. */}
        <path d={PATH} pathLength="1" fill="none" stroke="#E8C878" strokeOpacity="0.45" strokeWidth="3"
          strokeLinecap="round" strokeDasharray={`${f} 1`} filter="url(#jayl-trail-glow)" />
        <path d={PATH} pathLength="1" fill="none" stroke="url(#jayl-trail)" strokeWidth="1.4"
          strokeLinecap="round" strokeDasharray={`${f} 1`} />

        {/* La testa che brucia. */}
        <path d={PATH} pathLength="1" fill="none" stroke="#FFF4D0" strokeWidth="2.6" strokeLinecap="round"
          strokeDasharray="0.012 1" strokeDashoffset={-(f - 0.012)} filter="url(#jayl-trail-glow)"
          style={reduce ? undefined : { animation: 'jaylTrailPulse 1.6s ease-in-out infinite' }} />
        <path d={PATH} pathLength="1" fill="none" stroke="#FFF8E6" strokeWidth="1.6" strokeLinecap="round"
          strokeDasharray="0.004 1" strokeDashoffset={-(f - 0.004)} />
      </svg>

      {word && (
        <p className="mt-1.5 text-[9px] tracking-[0.42em] pl-[0.42em] uppercase" style={{ color: '#C4A35A' }}>
          {word}
        </p>
      )}

      <style>{'@keyframes jaylTrailPulse{0%,100%{opacity:.55}50%{opacity:1}}'}</style>
    </div>
  )
}
