// Client della pubblicazione rapida (api/publish-social.js, `action`).
// Stato dei social e pool dei testi si chiedono una volta per pagina e si
// condividono fra tutte le righe della lista prodotti.

import { useEffect, useState } from 'react'

const getAdminPassword = () => sessionStorage.getItem('jaylAdminPw') || ''

/** Cosa succede al clic su un social, per stato (`status.platforms[key].mode`). */
export const SOCIAL_MODES = {
  api:    { dot: 'bg-emerald-400', label: '1 clic (API)' },
  manual: { dot: 'bg-gray-500',    label: 'apre e copia' },
  error:  { dot: 'bg-red-500',     label: 'da sistemare' },
}

export async function socialCall(action, data = {}) {
  const res = await fetch('/api/publish-social', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: getAdminPassword(), ...data }),
  })
  const json = await res.json().catch(() => ({ error: `Errore server (${res.status})` }))
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

const store = { status: null, state: null, error: null, loading: null, subs: new Set() }
const notify = () => store.subs.forEach((f) => f())

function load(force = false) {
  if (store.loading && !force) return store.loading
  store.loading = Promise.all([socialCall('status'), socialCall('state')])
    .then(([status, state]) => { store.status = status; store.state = state; store.error = null })
    .catch((e) => { store.error = e.message })
    .finally(notify)
  return store.loading
}

/** Ricarica solo il pool e lo storico (dopo una pubblicazione). */
async function refreshState() {
  try { store.state = await socialCall('state') } catch (e) { store.error = e.message }
  notify()
}

export function useSocial() {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((n) => n + 1)
    store.subs.add(f)
    load()
    return () => { store.subs.delete(f) }
  }, [])
  return {
    status: store.status,
    state: store.state,
    error: store.error,
    refresh: () => load(true),
    refreshState,
  }
}
