import { isDropOpen } from '../../../api/_lib/drop.js'
import { nextDropStartsAt } from '../../../api/_lib/drop-schedule.js'

export const BEFORE = 'before'
export const LIVE   = 'live'
export const CLOSED = 'closed'

/**
 * Stato a tre valori della finestra del drop corrente. Usato sia da
 * `DropPanels` sia dalla sezione lista d'attesa in `HomePage`, così le due
 * non possono mai raccontare date diverse per lo stesso drop.
 *
 * - BEFORE: prima di `current.startsAt` — i pezzi si vedono in anteprima, non
 *   sono acquistabili (`checkDropGate` in api/create-payment-intent.js
 *   rifiuterebbe l'ordine).
 * - LIVE:   dentro `[startsAt, endsAt)` — la finestra è quella di `isDropOpen`,
 *   non ridefinita qui.
 * - CLOSED: dopo `endsAt`, o `current.productIds` vuoto (fra un drop e
 *   l'altro, prima che l'admin configuri il successivo).
 *
 * Per il target "prima dell'apertura" rispecchia lo stesso ragionamento già
 * commentato in api/create-payment-intent.js (checkDropGate, righe ~60-66):
 * prima di startsAt il prossimo drop a cui il cliente ha accesso è quello
 * CORRENTE (cfg.current.startsAt), non quello dopo — altrimenti il countdown
 * annuncerebbe la data del drop successivo mentre il carrello sta ancora
 * provando a comprare quello corrente.
 *
 * Negli stati CLOSED il target viene da nextDropStartsAt(): il primo drop
 * programmato ancora futuro, con fallback al vecchio `cfg.next` — così la
 * data annunciata è sempre quella su cui il cron agirà davvero.
 */
export function dropWindowState(cfg, now = new Date()) {
  const hasCurrentProducts = (cfg?.current?.productIds || []).length > 0
  if (!hasCurrentProducts) {
    return { state: CLOSED, target: nextDropStartsAt(cfg, now) }
  }

  if (isDropOpen(now, cfg)) {
    return { state: LIVE, target: cfg.current.endsAt }
  }

  const beforeOpen = cfg.current?.startsAt && now.getTime() < Date.parse(cfg.current.startsAt)
  if (beforeOpen) {
    return { state: BEFORE, target: cfg.current.startsAt }
  }

  return { state: CLOSED, target: nextDropStartsAt(cfg, now) }
}
