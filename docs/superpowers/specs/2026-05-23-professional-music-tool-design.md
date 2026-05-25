# Professional Music Tool — Design Spec
**Date:** 2026-05-23  
**Status:** Approved  
**Approach:** Vertical Slices (5 sprint indipendenti, ognuno shippabile)

---

## Contesto e obiettivo

L'app è un sistema AI multi-agente che genera e controlla codice Strudel in tempo reale tramite chat. Obiettivo: trasformarla in uno strumento professionale ibrido — usabile sia in studio (composizione) sia live sul palco.

**Vincoli raccolti:**
- Uso: ibrido live performance + composizione
- MIDI: output verso synth/DAW esterni (non input da controller)
- Gap AI critici: auto-fix errori runtime + AI ignora sample disponibili
- Gap UX critici: preset via `window.prompt()`, nessun editor di codice vero
- Pattern: singolo attivo + scene chainabili al ciclo successivo

---

## Architettura di sistema — modifiche trasversali

### Backend

**`backend/sample_registry.py`** (nuovo)
- Indicizza sample validi: soundfonts GM (~128 voci) + SuperDirt/Dirt-Samples standard
- `get_sample_context() → str` — testo compatto iniettato nel system prompt di `strudel_coder`
- Lista configurabile via `config.yaml`, nessuna chiamata esterna al boot

**`error_recovery_agent`** (nuovo nodo LangGraph in `backend/agents/`)
- Attivato dal supervisor quando `main.py` riceve `{ type: "runtime_error" }`
- Input: codice crashato + messaggio errore + ultimo messaggio utente
- Output: patch chirurgica (modifica solo la riga/espressione rotta, non riscrive tutto)
- Risponde come normale `{ type: "update", code: "..." }`

**`SessionPersistence`** (nuovo in `backend/`)
- Salva `conversation_history` su disco (JSON, un file per sessione) al termine di ogni request
- Carica la history al boot se esiste
- Risolve il gap "AI perde contesto al riavvio"

**`MidiOutputService`** (nuovo in `backend/`)
- `python-rtmidi` — invia MIDI Clock (24 ppqn) sincronizzato al BPM corrente
- MIDI Start/Stop al play/stop del player
- MIDI Program Change opzionale al cambio preset (configurabile)
- Nuovo endpoint `GET /midi/ports` — lista porte disponibili
- Gestito via WebSocket message `{ type: "midi_config", port: string, enabled: bool }`

### Frontend

**`SceneSlot`** — estende `Preset` con stato `queued` e coda `nextScene`

**`CodeEditor`** — Monaco Editor sostituisce l'area testo passiva in `StrudelPlayer`

**`PresetDrawer`** — slide-in panel sostituisce `PresetStrip` + `window.prompt()`

### Protocollo WebSocket — nuovi message type

| Direzione | Tipo | Payload |
|-----------|------|---------|
| frontend → backend | `runtime_error` | `{ message: string }` (già esiste) |
| frontend → backend | `scene_queue` | `{ queued_slot: number \| null }` |
| frontend → backend | `midi_config` | `{ port: string, enabled: bool }` |
| backend → frontend | `stream_chunk` | `{ text: string }` |
| backend → frontend | `midi_status` | `{ connected: bool, port: string }` |

---

## Sprint 1 — AI Quality

**Goal:** L'AI non inventa sample inesistenti e si autocorregge sugli errori Strudel.

### 1a — Sample Knowledge Base
- `SampleRegistry` costruita al boot da lista hardcoded (GM soundfonts + SuperDirt)
- Iniettata nel system prompt di `strudel_coder` come sezione `<available_samples>`
- Configurabile via `config.yaml` → `sample_registry.sources: [gm, superdirt, custom]`

### 1b — Error Recovery Agent
- Nuovo nodo `error_recovery_agent` nel grafo LangGraph
- Supervisor routing: intent `runtime_error` → `["error_recovery_agent", "response_agent"]`
- Prompt: riceve `current_code`, `error_message`, `last_user_message`
- Strategia: patch chirurgica, non riscrittura — regola esplicita nel prompt
- Output: `{ strudel_code: str }` come gli altri code-generating agents

### 1c — Streaming responses
- `response_agent` usa `stream=True` nell'API call
- Backend invia frame `{ type: "stream_chunk", text: "..." }` via WebSocket
- Frontend accumula e mostra progressivamente nella chat
- Al termine, arriva il normale `{ type: "update" }` con il codice completo

**Files toccati:**
- `backend/sample_registry.py` (nuovo)
- `backend/agents/error_recovery_agent.py` (nuovo)
- `backend/prompts/error_recovery_agent.yaml` (nuovo)
- `backend/agents/supervisor.py` (aggiunta intent `runtime_error`)
- `backend/graph.py` (aggiunta nodo + edge `error_recovery_agent`)
- `backend/agents/strudel_coder.py` (iniezione sample context)
- `backend/agents/response_agent.py` (streaming)
- `backend/main.py` (gestione `stream_chunk` + routing `runtime_error`)
- `frontend/src/hooks/useWebSocket.ts` (gestione `stream_chunk`)
- `frontend/src/components/Chat.tsx` (rendering streaming progressivo)

---

## Sprint 2 — Preset UI

**Goal:** Sostituire `window.prompt()` con un drawer professionale.

### Design del PresetDrawer
Pannello slide-in (dal basso), aperto da shortcut `P` o icona dedicata.

**Tipo `Preset` aggiornato:**
```typescript
interface Preset {
  code: string | null
  name: string | null
  color: string | null      // palette 8 colori
  bpm: number | null        // estratto da setcpm() nel codice
  musicalKey: string | null // dal musical_context backend
  createdAt: number | null  // unix timestamp
}
```
Retrocompatibile: preset esistenti migrati con `color: null, bpm: null, ...`.

**Ogni slot mostra:**
- Colore personalizzabile (click → palette 8 colori)
- Nome editabile inline (doppio click → `Enter` salva, `Escape` annulla)
- Badge BPM estratto automaticamente
- Badge key/scale se disponibile
- Preview code on-hover (tooltip prime 3 righe)
- Stato: vuoto / salvato / attivo / queued (Sprint 4)

**Interazioni:**
- Click singolo → carica preset
- Doppio click → rinomina inline
- Drag → riordina slot
- `Ctrl+S` → salva slot attivo
- Context menu → Salva / Carica / Duplica / Cancella / Colore

**Persistenza:** localStorage, retrocompatibile.

**Files toccati:**
- `frontend/src/types.ts` (Preset esteso)
- `frontend/src/components/PresetDrawer.tsx` (nuovo, sostituisce PresetStrip)
- `frontend/src/hooks/usePresets.ts` (migrazione + nuovi metodi)
- `frontend/src/App.tsx` (swap PresetStrip → PresetDrawer)
- `frontend/src/index.css` (stili drawer)

---

## Sprint 3 — Code Editor

**Goal:** Monaco Editor con Strudel syntax highlight + autocomplete + hover docs.

### Monaco Editor
- Package: `@monaco-editor/react` (~500KB gzipped)
- Sostituisce l'area codice passiva in `StrudelPlayer`
- Tema dark custom: `#0d1117` background, `#00d4aa` per keyword Strudel
- Resize verticale via handle

### Strudel Language Definition
1. **Syntax highlighting** — grammar JS-based + token extra per funzioni Strudel (`note`, `sound`, `s`, `n`, `slow`, `fast`, `stack`, `cat`, `seq`, `setcpm`, `mini`, ecc.)
2. **Autocomplete** (`CompletionItemProvider`):
   - ~80 funzioni Strudel con signature e descrizione
   - Sample della `SampleRegistry` come completion items in `sound(...)` e `s(...)`
   - Snippet: `stack`, `cat`, `mini notation`, pattern comuni
3. **Hover docs** (`HoverProvider`) — descrizione breve su `note()`, `slow()`, ecc.

### Shortcut
| Shortcut | Azione |
|----------|--------|
| `Ctrl+Enter` | Valuta subito (bypass debounce) |
| `Ctrl+Z / Y` | Undo/redo nativo Monaco |
| `Ctrl+/` | Toggle commento |

**Undo/redo nativo Monaco** copre anche il gap "no undo" segnalato.

**Files toccati:**
- `frontend/package.json` (aggiunta `@monaco-editor/react`)
- `frontend/src/components/CodeEditor.tsx` (nuovo)
- `frontend/src/lib/strudelLanguage.ts` (nuovo — language definition)
- `frontend/src/components/StrudelPlayer.tsx` (swap textarea → CodeEditor)
- `frontend/src/App.tsx` (propagazione `onManualEdit`)

---

## Sprint 4 — Scene System

**Goal:** Pattern singolo attivo + uno slot in coda che parte al prossimo ciclo Strudel.

### Meccanismo Queue-on-cycle
1. Utente clicca **[Queue]** su uno slot → slot marcato `queued` (badge arancione lampeggiante)
2. Al prossimo evento `cycle` di Strudel, il codice in coda swappa con l'attivo
3. Vecchio slot → `saved`, nuovo slot → `active`
4. Un solo slot in coda alla volta; cliccare un secondo dequeues il primo

### Hook `useSceneQueue`
```typescript
interface SceneQueue {
  queuedSlot: number | null
  queueScene: (slot: number) => void
  cancelQueue: () => void
}
```

`StrudelPlayer` espone `onCycleEnd` callback (hook `onTrigger`/`afterEval` dell'engine Strudel). `App.tsx` usa questa callback per eseguire lo swap quando `queuedSlot !== null`.

### UI nel PresetDrawer
- Ogni slot: secondo button **[⏭ Queue]**
- Barra superiore drawer: "⏭ Next: [slot name]" quando in coda
- `queued_slot: number | null` aggiunto al payload WebSocket (context per il backend)

**Nessun backend necessario** — logica interamente frontend.

**Files toccati:**
- `frontend/src/hooks/useSceneQueue.ts` (nuovo)
- `frontend/src/components/PresetDrawer.tsx` (aggiunta Queue button + indicatore)
- `frontend/src/components/StrudelPlayer.tsx` (esposizione `onCycleEnd`)
- `frontend/src/types.ts` (stato `queued` in Preset)
- `frontend/src/App.tsx` (integrazione useSceneQueue)
- `frontend/src/hooks/useWebSocket.ts` (aggiunta `queued_slot` nel payload)

---

## Sprint 5 — Live Kit

**Goal:** MIDI output, performance mode fullscreen, tap tempo, beat indicator.

### MIDI Output (backend)
- Package: `python-rtmidi`
- `MidiOutputService` in `backend/midi_service.py`
- Invia: MIDI Clock 24ppqn (sync BPM), MIDI Start/Stop, MIDI Program Change opzionale
- `GET /midi/ports` — lista porte disponibili
- Configurato via `{ type: "midi_config", port, enabled }` dal frontend
- Status visibile nell'header: `{ type: "midi_status", connected, port }`

### Performance Mode (frontend)
- Shortcut `F` o bottone dedicato
- Classe CSS `.performance-mode` su `<body>` — zero refactor strutturale
- Nasconde: chat, header, code editor
- Mostra: waveform grande (60%), knob panel, preset drawer compatto, beat indicator
- `Escape` per uscire

### Tap Tempo
- Bottone `TAP` nel `BpmEqPanel` + shortcut `T`
- Media mobile ultimi 4 tap
- Attivo dopo 3 tap, timeout 2s resetta
- Aggiorna direttamente lo stato BPM → `setcpm()` nel codice

### Beat Indicator
- Dot/barra pulsante agganciata a `onBeat` dell'engine Strudel
- In performance mode: più grande, più visibile
- Colore sincronizzato con la waveform

**Files toccati:**
- `backend/midi_service.py` (nuovo)
- `backend/main.py` (routing midi_config, endpoint /midi/ports)
- `backend/requirements.txt` (aggiunta `python-rtmidi`)
- `frontend/src/components/BpmEqPanel.tsx` (tap tempo button)
- `frontend/src/components/BeatIndicator.tsx` (nuovo)
- `frontend/src/hooks/useTapTempo.ts` (nuovo)
- `frontend/src/hooks/useMidi.ts` (nuovo — gestione midi_config/status)
- `frontend/src/App.tsx` (performance mode toggle, beat indicator)
- `frontend/src/index.css` (stili performance mode)

---

## Testing

Ogni sprint include:
- **Unit tests** per ogni nuovo modulo backend (pytest)
- **Unit tests** per ogni nuovo hook/componente frontend (Vitest)
- **Integration test** per il nuovo flusso WebSocket introdotto

Coverage minima: 80% per file nuovi.

---

## Dipendenze nuove

| Package | Tipo | Sprint | Motivo |
|---------|------|--------|--------|
| `@monaco-editor/react` | frontend | 3 | Code editor |
| `python-rtmidi` | backend | 5 | MIDI output |

Tutto il resto usa dipendenze già presenti.

---

## Ordine di esecuzione raccomandato

Sprint 1 → Sprint 2 → Sprint 3 → Sprint 4 → Sprint 5

Sprint 1 sblocca il ROI più alto (AI affidabile migliora l'esperienza di tutti gli sprint successivi). Gli sprint 2-4 sono indipendenti tra loro e possono essere parallelizzati se necessario. Sprint 5 non ha dipendenze hard dagli sprint precedenti — può essere eseguito in qualsiasi ordine dopo Sprint 1. Il riferimento a `queued_slot` del Sprint 4 è un'aggiunta di contesto opzionale, non un prerequisito bloccante.
