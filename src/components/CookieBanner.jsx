import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CONSENT_EVENT } from '@/lib/trustpilot'

const STORAGE_KEY = 'jayl_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [biting, setBiting]   = useState(false)
  const [bitten, setBitten]   = useState(false)

  useEffect(() => {
    let choice = null
    try { choice = localStorage.getItem(STORAGE_KEY) } catch {}
    // Restore full consent immediately if the user already accepted.
    // (Marketing pixels self-load from index.html on 'accepted'.)
    if (choice === 'accepted' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage:  'granted',
        ad_storage:         'granted',
        ad_user_data:       'granted',
        ad_personalization: 'granted',
      })
    }
    // Show banner only if user hasn't made a choice yet
    if (!choice) setVisible(true)
  }, [])

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, 'accepted') } catch {}
    // Grant analytics + marketing consent and fire first page_view
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage:  'granted',
        ad_storage:         'granted',
        ad_user_data:       'granted',
        ad_personalization: 'granted',
      })
      window.gtag('event', 'page_view', {
        page_path:     window.location.pathname,
        page_location: window.location.href,
      })
    }
    // Load the marketing pixels (Meta + Pinterest) now that consent is given
    if (typeof window.__jaylLoadMarketing === 'function') window.__jaylLoadMarketing()
    // Tell already-mounted consent-gated widgets (Trustpilot) they can load
    // now, so they appear without a reload.
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT))
    setVisible(false)
  }

  // Prima i morsi, poi il consenso e l'uscita.
  const onAccept = () => {
    if (biting) return
    setBiting(true)
    setTimeout(() => { setBitten(true); setTimeout(accept, 350) }, 550)
  }

  const decline = () => {
    try { localStorage.setItem(STORAGE_KEY, 'declined') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <AnimatePresence>
      {!bitten && (
        <motion.div
          role="dialog"
          aria-label="Cookies"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.8, duration: 0.5, ease: [0.16, 1, 0.3, 1] } }}
          exit={{ opacity: 0, y: 16, transition: { duration: 0.35 } }}
          // Una pillola in un angolo invece della barra a tutta larghezza:
          // non copre prezzo, taglie e "Add to cart" a chi arriva da un ad.
          className="fixed z-[200] bottom-3 left-3 right-3 sm:right-auto sm:max-w-[400px] rounded-2xl border shadow-2xl"
          style={{ backgroundColor: '#111111', borderColor: 'rgba(196,163,90,0.22)' }}
        >
          <div className="flex items-center gap-3 pl-3 pr-2.5 py-2.5">
            <CookieMark bite={biting} />

            <div className="flex-1 min-w-0">
              <p className="font-display text-[15px] leading-tight text-cream">Who doesn&apos;t like cookies?</p>
              <p className="text-[10px] leading-snug mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Analytics &amp; ads, only if you say yes.{' '}
                <Link to="/cookies" onClick={decline} className="underline" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Policy
                </Link>
              </p>
            </div>

            {/* Rifiutare deve restare visibile quanto accettare (GDPR). */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={decline}
                className="text-[11px] px-2.5 py-2 rounded-full transition-colors hover:text-white/70"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                No thanks
              </button>
              <button
                onClick={onAccept}
                className="text-[11px] px-3.5 py-2 rounded-full font-medium transition-transform active:scale-95"
                style={{ backgroundColor: '#C4A35A', color: '#111111' }}
              >
                Feed me
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Il biscotto: al "Feed me" riceve due morsi, poi il banner se ne va.
function CookieMark({ bite }) {
  return (
    <motion.svg
      viewBox="0 0 40 40" width="38" height="38" aria-hidden className="flex-shrink-0"
      animate={bite ? { rotate: [0, -12, 8, 0], scale: [1, 1.08, 1] } : { rotate: [0, -6, 6, 0] }}
      transition={bite ? { duration: 0.5 } : { duration: 1.2, delay: 1.6, repeat: Infinity, repeatDelay: 4 }}
    >
      <defs>
        <mask id="jayl-cookie-bite">
          <rect width="40" height="40" fill="white" />
          <motion.circle cx="35" cy="7" fill="black" initial={{ r: 0 }} animate={{ r: bite ? 8 : 0 }} transition={{ duration: 0.18 }} />
          <motion.circle cx="38" cy="17" fill="black" initial={{ r: 0 }} animate={{ r: bite ? 6 : 0 }} transition={{ duration: 0.18, delay: 0.2 }} />
        </mask>
      </defs>
      <g mask="url(#jayl-cookie-bite)">
        <circle cx="20" cy="20" r="17" fill="#C4A35A" />
        <circle cx="20" cy="20" r="17" fill="none" stroke="#8C6F2E" strokeWidth="1.5" />
        {[[13, 14, 2.4], [24, 11, 2], [27, 22, 2.6], [16, 26, 2.2], [21, 19, 1.6], [11, 21, 1.4]].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#3B2A12" />
        ))}
      </g>
    </motion.svg>
  )
}
