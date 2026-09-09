#!/usr/bin/env node
// Verifica della promozione automatica dei drop — api/_lib/drop-schedule.js,
// la logica che il cron delle 08:00 esegue su src/data/drop.js.
//
// Alta conseguenza: qui non c'è nessuno a guardare. Il cron legge la config,
// decide, e COMMITTA su main — il commit fa partire il deploy, il deploy
// rigenera il bundle del client. Una decisione sbagliata a quell'ora non
// produce un errore visibile: produce un drop chiuso a metà, o dei pannelli
// home che puntano a prodotti che il bundle non contiene, e lo si scopre da
// un cliente.
//
// Ogni config qui è SINTETICA e ogni `now` è finto. È già costato due volte:
// un test che leggeva l'orologio reale avrebbe fatto fallire ogni deploy per
// le 72 ore di un drop. Run: node scripts/test-drop-schedule.js

import { pickDueDrop, promoteDrop, archiveDrop, nextDropStartsAt, PROMOTION_LEAD_MS } from '../api/_lib/drop-schedule.js'
import { validateDropConfig } from '../api/_lib/drop-config.js'

let passed = 0
const failures = []

function check(label, cond) {
  if (cond) { passed++; return }
  failures.push(label)
}

// ── Fixture ─────────────────────────────────────────────────────────────────
const entry = (over = {}) => ({
  id: 'drop-02-test',
  number: 2,
  title: 'TEST 02',
  productIds: ['bbb'],
  startsAt: '2026-02-10T16:00:00Z',
  endsAt:   '2026-02-13T16:00:00Z',
  cap: 20,
  caps: {},
  dropPrice: 2200,
  bundlePrice: 5700,
  ...over,
})

const cfg = (over = {}) => ({
  current: entry({
    id: 'drop-01-test', number: 1, title: 'TEST 01',
    productIds: ['aaa'],
    startsAt: '2026-02-01T16:00:00Z',
    endsAt:   '2026-02-04T16:00:00Z',
  }),
  previous: null,
  scheduled: [],
  released: [],
  archivePrice: 2500,
  ...over,
})

const at = (iso) => new Date(iso)

// ── pickDueDrop — quando NON promuovere ─────────────────────────────────────
{
  check('scheduled vuoto → nessuna promozione',
    pickDueDrop(cfg(), at('2026-02-10T08:00:00Z')).entry === null)

  check('scheduled assente del tutto (config pre-scheduling) → nessuna promozione, nessun crash',
    pickDueDrop({ ...cfg(), scheduled: undefined }, at('2026-02-10T08:00:00Z')).entry === null)

  // Il caso che conta più di tutti: il drop corrente è ancora aperto. Chiudere
  // qui significa spostare in listino a prezzo pieno dei pezzi che qualcuno
  // sta comprando a prezzo drop.
  const overlapping = cfg({ scheduled: [entry({ startsAt: '2026-02-03T16:00:00Z', endsAt: '2026-02-06T16:00:00Z' })] })
  const duringDrop = pickDueDrop(overlapping, at('2026-02-03T08:00:00Z'))
  check('drop corrente ancora aperto → promozione rimandata', duringDrop.entry === null)
  check('drop corrente ancora aperto → il motivo lo dice esplicitamente',
    /ancora in corso/.test(duringDrop.reason))

  // Anche in stato BEFORE (drop corrente promosso ma non ancora aperto) non si
  // promuove: `t < endsAt` copre sia BEFORE sia LIVE.
  check('drop corrente in anteprima (BEFORE) → promozione rimandata',
    pickDueDrop(overlapping, at('2026-02-01T08:00:00Z')).entry === null)

  // Fuori dalla finestra di anticipo.
  const farAway = cfg({ scheduled: [entry()] })
  check('drop programmato a più di 24h → non ancora dovuto',
    pickDueDrop(farAway, at('2026-02-08T08:00:00Z')).entry === null)

  // Una voce il cui endsAt è già passato nascerebbe morta: mai promossa, ma
  // nemmeno rimossa in silenzio — resta dove l'admin la vede.
  const expired = cfg({ scheduled: [entry({ startsAt: '2026-01-01T16:00:00Z', endsAt: '2026-01-04T16:00:00Z' })] })
  const expiredPick = pickDueDrop(expired, at('2026-02-10T08:00:00Z'))
  check('drop programmato già scaduto → mai promosso', expiredPick.entry === null)
  check('drop programmato già scaduto → resta in scheduled (non sparisce)',
    expired.scheduled.length === 1)

  check('date non parseabili in una voce programmata → nessuna promozione, nessun crash',
    pickDueDrop(cfg({ scheduled: [entry({ startsAt: 'domani', endsAt: 'dopodomani' })] }), at('2026-02-10T08:00:00Z')).entry === null)
}

// ── pickDueDrop — quando promuovere ─────────────────────────────────────────
{
  const ready = cfg({ scheduled: [entry()] })

  // Il caso nominale: drop 01 chiuso il 4, cron delle 08:00 del 10, drop 02
  // apre alle 16:00 dello stesso giorno. Otto ore di vetrina d'attesa.
  const due = pickDueDrop(ready, at('2026-02-10T08:00:00Z'))
  check('drop corrente finito + programmato entro 24h → promosso', due.entry?.id === 'drop-02-test')

  // Il bordo esatto della finestra: a 24h precise è dentro, un istante prima è
  // fuori. Vale la pena fissarlo, perché è ciò che garantisce che UN giro di
  // cron al giorno prenda sempre ogni drop prima che apra.
  const openMs = Date.parse('2026-02-10T16:00:00Z')
  check('esattamente a 24h dall\'apertura → dentro la finestra',
    pickDueDrop(ready, new Date(openMs - PROMOTION_LEAD_MS)).entry !== null)
  check('un millisecondo oltre le 24h → fuori dalla finestra',
    pickDueDrop(ready, new Date(openMs - PROMOTION_LEAD_MS - 1)).entry === null)

  // Un drop già aperto (cron saltato, config aggiunta tardi) va comunque
  // promosso: meglio in ritardo che mai — è ancora dentro la sua finestra.
  check('programmato già aperto ma non ancora finito → promosso comunque',
    pickDueDrop(ready, at('2026-02-11T08:00:00Z')).entry?.id === 'drop-02-test')

  // Ordine: vince il più vicino ad aprire, non il primo dell'array.
  const unordered = cfg({
    scheduled: [
      entry({ id: 'drop-04-test', number: 4, startsAt: '2026-03-10T16:00:00Z', endsAt: '2026-03-13T16:00:00Z' }),
      entry({ id: 'drop-03-test', number: 3, startsAt: '2026-02-10T16:00:00Z', endsAt: '2026-02-13T16:00:00Z' }),
    ],
  })
  check('più drop programmati → vince quello che apre prima, non il primo dell\'array',
    pickDueDrop(unordered, at('2026-02-10T08:00:00Z')).entry?.id === 'drop-03-test')
}

// ── promoteDrop ─────────────────────────────────────────────────────────────
{
  const before = cfg({ scheduled: [entry()], released: ['zzz'] })
  const { index } = pickDueDrop(before, at('2026-02-10T08:00:00Z'))
  const after = promoteDrop(before, index)

  check('promoteDrop: il programmato diventa current', after.current.id === 'drop-02-test')
  check('promoteDrop: esce da scheduled', after.scheduled.length === 0)
  check('promoteDrop: il drop uscente finisce in previous',
    after.previous?.number === 1 && after.previous?.productIds.join() === 'aaa')
  check('promoteDrop: i pezzi uscenti entrano in listino, senza perdere i precedenti',
    after.released.includes('zzz') && after.released.includes('aaa'))
  check('promoteDrop: released resta senza duplicati',
    new Set(after.released).size === after.released.length)

  // Nessuna mutazione dell'originale: il chiamante (il cron) deve poter
  // abortire dopo la validazione senza aver già sporcato la config che ha in
  // mano.
  check('promoteDrop: non muta la config passata',
    before.current.id === 'drop-01-test' && before.scheduled.length === 1)

  // Il risultato deve essere scrivibile: se non passasse validateDropConfig,
  // il cron scriverebbe un file che fa fallire ogni prebuild successivo.
  check('promoteDrop: il risultato passa validateDropConfig()',
    validateDropConfig(after).ok === true)

  // Drop già chiuso a mano dall'admin (productIds vuoto): `previous` non va
  // sovrascritto con un vuoto, o la home perde il suo fallback.
  const manuallyClosed = cfg({
    current: { ...cfg().current, productIds: [] },
    previous: { number: 1, title: 'TEST 01', productIds: ['aaa'] },
    scheduled: [entry()],
  })
  const afterManual = promoteDrop(manuallyClosed, 0)
  check('promoteDrop: previous preservato se il drop era già chiuso a mano',
    afterManual.previous?.productIds.join() === 'aaa')
}

// ── archiveDrop — l'archivio storico letto dal pannello ─────────────────────
// Serve a una cosa sola: che un drop concluso smetta di occupare la sezione
// "Drop corrente" del pannello come se stesse ancora vendendo. Le regole che
// contano sono l'idempotenza (chiusura manuale + giro di cron toccano lo
// stesso drop uscente) e il non archiviare un guscio già svuotato sopra la
// voce buona.
{
  const outgoing = { id: 'drop-01', number: 1, title: 'ORIGIN', productIds: ['aaa'], startsAt: '2026-02-01T16:00:00Z', endsAt: '2026-02-04T16:00:00Z' }

  const first = archiveDrop({ past: [] }, outgoing)
  check('archiveDrop: archivia un drop concluso', first.length === 1 && first[0].id === 'drop-01')
  check('archiveDrop: conserva finestra e pezzi',
    first[0].startsAt === '2026-02-01T16:00:00Z' && first[0].endsAt === '2026-02-04T16:00:00Z' && first[0].productIds.join() === 'aaa')

  check('archiveDrop: idempotente sullo stesso id (close-drop poi cron)',
    archiveDrop({ past: first }, outgoing).length === 1)

  check('archiveDrop: non archivia un drop già svuotato',
    archiveDrop({ past: [] }, { ...outgoing, productIds: [] }).length === 0)

  check('archiveDrop: past assente → parte da zero senza rompersi',
    archiveDrop({}, outgoing).length === 1)

  const promoted = promoteDrop(cfg({ scheduled: [entry()] }), 0)
  check('promoteDrop: il drop uscente finisce in past',
    (promoted.past || []).length === 1 && promoted.past[0].id === cfg().current.id)
  check('promoteDrop: past resta valido per validateDropConfig',
    validateDropConfig(promoted).ok === true)
}

// ── nextDropStartsAt — la data annunciata dai countdown ─────────────────────
{
  check('nextDropStartsAt: preferisce il primo programmato futuro',
    nextDropStartsAt(cfg({ scheduled: [entry()], next: { number: 9, startsAt: '2026-12-01T16:00:00Z' } }), at('2026-02-05T08:00:00Z'))
      === '2026-02-10T16:00:00Z')

  check('nextDropStartsAt: fallback al vecchio cfg.next se scheduled è vuoto',
    nextDropStartsAt(cfg({ next: { number: 2, startsAt: '2026-02-10T16:00:00Z' } }), at('2026-02-05T08:00:00Z'))
      === '2026-02-10T16:00:00Z')

  check('nextDropStartsAt: ignora i programmati già aperti',
    nextDropStartsAt(cfg({ scheduled: [entry()] }), at('2026-02-11T08:00:00Z')) === null)

  check('nextDropStartsAt: null quando non c\'è niente da annunciare',
    nextDropStartsAt(cfg(), at('2026-02-05T08:00:00Z')) === null)
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ ${failures.length} controlli falliti (${passed} passati) su drop-schedule:\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`))
  console.error('')
  process.exit(1)
}
console.log(`✓ drop-schedule: ${passed} controlli passati`)
