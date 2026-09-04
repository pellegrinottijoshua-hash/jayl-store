---
name: higgsfield-unlimited
description: Genera immagini GRATIS su higgsfield.ai via Chrome (Nano Banana Pro, modalità Unlimited) da un file di prompt. Uso: /higgsfield-unlimited <path del file .md con blocchi ``` di prompt>. Delegabile a un subagent Sonnet. Zero crediti garantito da guardia obbligatoria.
---

# Higgsfield Unlimited runner

Esegui ogni blocco ``` del file di prompt passato come argomento: 4 job gratuiti per blocco, in ordine.

## Setup (una volta)
1. Tool: `mcp__claude-in-chrome__*` (se deferred: ToolSearch "select:mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__tabs_context_mcp").
2. `tabs_context_mcp{createIfEmpty:true}` → naviga a `https://higgsfield.ai/ai/image?model=nano-banana-pro` (utente già loggato; se non loggato FERMATI e riporta).
3. Screenshot → individua nel composer in basso: area testo prompt, count (−/+), toggle "Unlimited", bottone Generate a destra. Le coordinate cambiano con la finestra: ricalcolale SEMPRE dallo screenshot, mai fidarsi di valori memorizzati.
4. Stato richiesto: count **1/4**, toggle Unlimited **verde**, bottone = **"Unlimited ✦"**.

## GUARDIA ANTI-CREDITI (obbligatoria, non negoziabile)
Prima di OGNI serie di click su Generate: zoom sulla barra del composer. Se il bottone mostra un NUMERO (es. "Generate ✦ 2") NON cliccare: riporta count a 1, riaccendi il toggle, ri-verifica. Vietato cliccare: Upgrade, Boost speed, Invite friends, cambi modello/aspect/risoluzione. Popup → chiudere con la X. Il toggle si SPEGNE da solo se alzi il count: per varianti multiple si clicca Generate più volte (1s di pausa), max 4 job in coda.

## Ciclo per ogni blocco prompt
1. Click area testo → `cmd+a` → `type` col testo del blocco (se il type risulta parziale: cmd+a e riprova 1 volta, poi salta e logga)
2. Guardia (sopra)
3. 4 × click Generate (1s tra i click)
4. Attendi: cicli `wait` 10s fino a ~90s, screenshot; se i 4 tile in alto mostrano ancora la coda, attendi a step di 30s (max 5 min), poi prosegui col blocco successivo

## Reference image
- La thumbnail nel composer (in alto a sinistra) è la character reference: resta attaccata per i prompt col personaggio; per prompt di soli ambienti/props rimuovila (X sulla thumbnail) — ordina il file di prompt per non dover ri-attaccare.
- Per attaccare una generazione precedente come reference: aprila dalla galleria e usa il suo bottone "riusa come input/reference".

## Chiusura
Scrivi un log (path indicato dal chiamante, default `metrics/run-<data>.md` accanto al file prompt): inizio/fine, blocchi eseguiti/saltati, conferma che il bottone è sempre stato "Unlimited ✦". Le immagini restano nella galleria Higgsfield: non scaricarle se non richiesto.
