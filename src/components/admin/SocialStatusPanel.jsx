import { useState } from 'react'
import { PLATFORMS, FORMAT_LABELS } from '@/lib/socialPlatforms'
import { useSocial, socialCall, SOCIAL_MODES } from '@/lib/socialClient'

// Cosa può fare ogni social dall'admin, e cosa manca per arrivare a 1 clic:
// stato del collegamento (dal server, senza mai mostrare un token), formati,
// salute del token Meta, board di Pinterest.

export default function SocialStatusPanel() {
  const { status, error, refresh } = useSocial()
  const [saving, setSaving] = useState(false)

  if (!status) {
    return (
      <p className={`text-xs ${error ? 'text-red-400' : 'text-gray-500'}`}>
        {error ? `Stato dei social non disponibile: ${error} ` : 'Controllo i collegamenti dei social…'}
        {error && <button type="button" onClick={refresh} className="underline text-gray-400 hover:text-white">↻ riprova</button>}
      </p>
    )
  }

  const meta = status.meta || {}
  const pin = status.platforms?.pinterest || {}
  const days = meta.expiresAt && meta.expiresAt !== 'never'
    ? Math.round((new Date(meta.expiresAt) - Date.now()) / 86_400_000)
    : null
  const expiry = meta.expiresAt === 'never' ? 'non scade' : days === null ? 'scadenza non verificabile' : `scade fra ${days} giorni`

  const setBoard = async (boardId) => {
    setSaving(true)
    try { await socialCall('settings', { pinterestBoardId: boardId || null }); await refresh() } finally { setSaving(false) }
  }

  return (
    <div className="border border-gray-800 bg-[#0a0a0a] p-3 space-y-2.5 text-xs">
      <div className="flex items-center justify-between">
        <p className="text-gray-300 font-semibold uppercase tracking-wider">Cosa fa ogni social</p>
        <button type="button" onClick={refresh} className="text-[10px] text-gray-500 hover:text-white">↻ ricontrolla</button>
      </div>

      <ul className="space-y-1.5">
        {PLATFORMS.map((p) => {
          const s = status.platforms?.[p.key] || {}
          const m = SOCIAL_MODES[s.mode] || SOCIAL_MODES.manual
          return (
            <li key={p.key} className="flex flex-wrap items-start gap-x-3 gap-y-0.5">
              <span className="flex items-center gap-1.5 w-24 flex-shrink-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
                <span className="font-semibold" style={{ color: p.color }}>{p.label}</span>
              </span>
              <span className="w-24 flex-shrink-0 text-gray-300">{m.label}</span>
              <span className="w-32 flex-shrink-0 text-gray-500">{Object.keys(p.formats).map((f) => FORMAT_LABELS[f]).join(' · ')}</span>
              <span className="text-gray-500 min-w-0 flex-1 basis-48 break-words">{s.detail}</span>
            </li>
          )
        })}
      </ul>

      {pin.boards?.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-gray-400">
          Board Pinterest
          <select
            value={pin.boardId || ''}
            disabled={saving}
            onChange={(e) => setBoard(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-200 px-2 py-1"
          >
            <option value="">— scegli —</option>
            {pin.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      )}

      {(meta.ok || meta.error) && (
        <p className={`text-[11px] ${meta.ok && !meta.missingScopes?.length && (days === null || days > 7) ? 'text-gray-500' : 'text-amber-400'}`}>
          Meta: {meta.ok
            ? `${meta.pageName ? `Pagina ${meta.pageName}` : 'nessuna Pagina'}${meta.igUsername ? ` · Instagram @${meta.igUsername}` : ''} · token ${meta.tokenType === 'PAGE' ? 'di Pagina' : meta.tokenType === 'USER' ? 'utente' : '?'}, ${expiry}`
            : meta.error}
          {meta.missingScopes?.length > 0 && ` · permessi mancanti: ${meta.missingScopes.join(', ')}`}
        </p>
      )}
    </div>
  )
}
