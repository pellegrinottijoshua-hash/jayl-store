import { useState } from 'react'
import LegalPage from './LegalPage'

function ContactForm() {
  const [form, setForm]     = useState({ name: '', email: '', subject: '', message: '' })
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError]   = useState('')

  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending'); setError('')
    try {
      const res  = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setStatus('sent')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  const inputCls = [
    'w-full bg-transparent border-b border-ink-muted/30 text-ink text-sm py-2.5',
    'focus:outline-none focus:border-ink transition-colors placeholder:text-ink-muted/50',
  ].join(' ')

  if (status === 'sent') {
    return (
      <div className="border border-paper-border bg-paper-2 px-6 py-8 text-center mt-8">
        <p className="font-display text-2xl text-ink mb-2">Message sent.</p>
        <p className="text-ink-secondary text-sm leading-relaxed">
          We'll get back to you within 48 hours. Check your inbox for a confirmation.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-ink-muted text-[10px] uppercase tracking-widest mb-2">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={set('name')}
            required
            placeholder="Your name"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-ink-muted text-[10px] uppercase tracking-widest mb-2">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            required
            placeholder="your@email.com"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="block text-ink-muted text-[10px] uppercase tracking-widest mb-2">Subject</label>
        <input
          type="text"
          value={form.subject}
          onChange={set('subject')}
          placeholder="Order question, collaboration, other…"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-ink-muted text-[10px] uppercase tracking-widest mb-2">Message *</label>
        <textarea
          value={form.message}
          onChange={set('message')}
          required
          rows={5}
          placeholder="Tell us what's on your mind…"
          className={`${inputCls} resize-none`}
        />
      </div>

      {status === 'error' && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="inline-flex items-center gap-2 bg-ink text-paper text-xs font-sans tracking-widest uppercase px-7 py-3.5 hover:opacity-80 transition-opacity disabled:opacity-40"
      >
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}

export default function ContactPage() {
  return (
    <LegalPage title="Get in Touch">
      <p>
        Questions about an order, a product, or a collaboration? We're here.
      </p>
      <p>
        You can also reach us directly at{' '}
        <a href="mailto:thejaylstore@gmail.com" className="text-ink underline underline-offset-4">
          thejaylstore@gmail.com
        </a>
        . We aim to respond within 48 hours.
      </p>
      <p className="text-ink-muted text-sm">All orders are fulfilled by Gelato worldwide.</p>
      <ContactForm />
    </LegalPage>
  )
}
