#!/usr/bin/env node
// Verifica di api/_lib/social-links.js — la normalizzazione dei link social e
// la forma canonica di src/data/social-links.js.
//
// Alta conseguenza per due motivi distinti:
//
// 1. Questi valori finiscono in un <a href> renderizzato a OGNI visitatore del
//    sito (Navbar, desktop e menu mobile). Uno schema non http — `javascript:`
//    in testa a tutti — sarebbe codice eseguibile nel browser di chiunque. Che
//    il campo stia dietro la password dell'admin non cambia la classe del
//    problema, cambia solo chi può innescarlo.
// 2. La lista dei canali è una sola (SOCIAL_CHANNELS) e alimenta tre percorsi:
//    la whitelist del server, i campi del pannello, le icone della navbar.
//    Quando erano tre copie divergevano — `facebook` aveva una chiave nel file
//    di dati, nessun campo, nessuna icona e nessun posto nella whitelist.
//
// Run: node scripts/test-social-links.js

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import {
  SOCIAL_CHANNELS,
  SOCIAL_KEYS,
  normalizeSocialLink,
  sanitizeSocialLinks,
  serializeSocialLinks,
} from '../api/_lib/social-links.js'
import { SOCIAL_LINKS as liveLinks } from '../src/data/social-links.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LINKS_PATH = resolve(__dirname, '../src/data/social-links.js')

let passed = 0
const failures = []

function check(label, cond) {
  if (cond) { passed++; return }
  failures.push(label)
}

const ig = SOCIAL_CHANNELS.find((c) => c.key === 'instagram')
const tt = SOCIAL_CHANNELS.find((c) => c.key === 'tiktok')

// ── Schemi pericolosi ───────────────────────────────────────────────────────
// Rifiutati, non "riparati": trasformarli in un handle produrrebbe un link
// plausibile a partire da un input che plausibile non era.
{
  check('javascript: → rifiutato',
    normalizeSocialLink('javascript:alert(1)', ig) === '')
  check('JavaScript: (maiuscole miste) → rifiutato',
    normalizeSocialLink('JaVaScRiPt:alert(1)', ig) === '')
  check('data: → rifiutato',
    normalizeSocialLink('data:text/html,<script>alert(1)</script>', ig) === '')
  check('mailto: → rifiutato',
    normalizeSocialLink('mailto:tizio@example.com', ig) === '')
  check('file: → rifiutato',
    normalizeSocialLink('file:///etc/passwd', ig) === '')
}

// ── Handle senza protocollo ─────────────────────────────────────────────────
// Il caso realistico: un admin incolla l'handle invece dell'URL. Senza
// espansione finirebbe in <a href="jayl">, un link RELATIVO che porta a una
// 404 del proprio sito — e che a un test veloce sembra funzionare, perché il
// click apre comunque qualcosa.
{
  check('handle nudo → espanso con la base del canale',
    normalizeSocialLink('jayl', ig) === 'https://instagram.com/jayl')
  check('handle con @ → la @ non viene duplicata',
    normalizeSocialLink('@jayl', ig) === 'https://instagram.com/jayl')
  check('handle su un canale che usa @ nell\'URL → la @ viene aggiunta',
    normalizeSocialLink('jayl', tt) === 'https://tiktok.com/@jayl')
  check('handle già con @ su TikTok → una sola @',
    normalizeSocialLink('@jayl', tt) === 'https://tiktok.com/@jayl')
  check('solo una @ → vuoto (non un link alla home del social)',
    normalizeSocialLink('@', ig) === '')
}

// ── URL completi ────────────────────────────────────────────────────────────
{
  check('URL https → passa',
    normalizeSocialLink('https://instagram.com/jayl', ig) === 'https://instagram.com/jayl')
  check('URL http → passa (non forzato a https: potrebbe rompere un redirect)',
    normalizeSocialLink('http://instagram.com/jayl', ig).startsWith('http://'))
  check('spazi attorno → rimossi',
    normalizeSocialLink('  https://instagram.com/jayl  ', ig) === 'https://instagram.com/jayl')
  check('stringa vuota → vuota (canale scollegato)',
    normalizeSocialLink('', ig) === '')
  check('undefined → vuoto, nessun crash',
    normalizeSocialLink(undefined, ig) === '')
}

// ── sanitizeSocialLinks ─────────────────────────────────────────────────────
{
  const safe = sanitizeSocialLinks({ instagram: '@jayl', tiktok: 'https://tiktok.com/@jayl' })
  check('sanitize: tutte le chiavi presenti anche se non passate',
    SOCIAL_KEYS.every((k) => k in safe))
  check('sanitize: i canali non passati restano vuoti',
    safe.youtube === '' && safe.facebook === '')
  check('sanitize: normalizza i valori passati',
    safe.instagram === 'https://instagram.com/jayl')
  check('sanitize: una chiave sconosciuta viene scartata',
    !('myspace' in sanitizeSocialLinks({ myspace: 'https://myspace.com/jayl' })))
}

// ── Il file su disco è nella forma canonica ─────────────────────────────────
// Il pannello riscrive questo file per intero a ogni salvataggio, con lo
// stesso serializeSocialLinks: se la versione su disco divergesse, il primo
// save produrrebbe un diff enorme e illeggibile che non c'entra nulla con la
// modifica fatta dall'admin.
{
  const onDisk = readFileSync(LINKS_PATH, 'utf-8')
  check('src/data/social-links.js è esattamente ciò che scriverebbe il pannello',
    onDisk === serializeSocialLinks(liveLinks))

  check('il modulo esporta tutte e sole le chiavi di SOCIAL_CHANNELS',
    JSON.stringify(Object.keys(liveLinks).sort()) === JSON.stringify([...SOCIAL_KEYS].sort()))

  // Un valore già rotto sul file passerebbe inosservato fino al render: qui
  // fallisce prima del deploy.
  const reNormalized = sanitizeSocialLinks(liveLinks)
  check('ogni link già scritto sul file sopravvive alla normalizzazione',
    SOCIAL_KEYS.every((k) => (liveLinks[k] || '') === reNormalized[k]))
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ ${failures.length} controlli falliti (${passed} passati) su social-links:\n`)
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`))
  console.error('')
  process.exit(1)
}
console.log(`✓ social-links: ${passed} controlli passati`)
