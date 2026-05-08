import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY  = 'jayl-email-popup'
const DISCOUNT_CODE = 'JAYL10'
const DELAY_MS      = 8_000   // 8 seconds

export default function EmailCapturePopup() {
  const [visible,   setVisible]   = useState(false)
  const [email,     setEmail]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    // Don't show if already dismissed / subscribed
    const status = localStorage.getItem(STORAGE_KEY)
    if (status) return

    const timer = setTimeout(() => setVisible(true), DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, 'dismissed')
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/capture-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setSubmitted(true)
      localStorage.setItem(STORAGE_KEY, 'subscribed')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-0 sm:pb-0"
      onClick={e => { if (e.target === e.currentTarget) dismiss() }}
    >
      {/* Panel */}
      <div className="relative bg-off-black border border-border w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden">
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-text-muted hover:text-cream transition-colors z-10"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="p-8 sm:p-10">
          {submitted ? (
            // ── Success state ──────────────────────────────────────────────
            <div className="text-center space-y-4">
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="font-display text-2xl text-cream">You're in.</h2>
              <p className="text-text-secondary text-sm leading-relaxed">
                Welcome to JAYL. Here's your exclusive discount code:
              </p>
              <div className="bg-gray-900 border border-border-light rounded-lg px-6 py-4 my-4">
                <p className="font-sans font-light text-2xl text-cream">
                  {DISCOUNT_CODE}
                </p>
                <p className="text-text-muted text-xs mt-1">10% off your first order</p>
              </div>
              <p className="text-text-muted text-xs">Use it at checkout. Valid on all items.</p>
              <button
                onClick={() => setVisible(false)}
                className="mt-4 text-xs text-text-muted hover:text-cream underline underline-offset-2 transition-colors"
              >
                Start shopping →
              </button>
            </div>
          ) : (
            // ── Capture form ──────────────────────────────────────────────
            <div className="space-y-5">
              <div>
                <p className="text-xs text-text-muted uppercase tracking-widest mb-3">Exclusive offer</p>
                <h2 className="font-display text-2xl sm:text-3xl text-cream leading-tight">
                  10% off your<br />first order
                </h2>
              </div>
              <p className="text-text-secondary text-sm leading-relaxed">
                Join the JAYL community. Get early access to new drops, behind-the-scenes content, and your welcome discount.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full bg-gray-900 border border-border text-cream px-4 py-3 text-sm focus:outline-none focus:border-border-light transition-colors placeholder:text-text-muted"
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-cream text-off-black py-3 text-sm font-semibold tracking-wide disabled:opacity-40 transition-opacity hover:opacity-90"
                >
                  {loading ? 'Just a sec…' : 'Claim my 10% off'}
                </button>
              </form>

              <p className="text-text-muted text-xs text-center">
                No spam. Unsubscribe any time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
