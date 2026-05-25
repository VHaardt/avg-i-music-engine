# Design: Sistema Multi-Agente per Musica Live

**Data:** 2026-05-18  
**Stato:** Draft  

---

## 1. Obiettivo

Un sistema multi-agente che permette a persone senza conoscenze musicali di creare e performare musica live tramite linguaggio naturale. L'utente descrive cosa vuole — gli agenti traducono, compongono e modificano il codice Strudel in tempo reale.

---

## 2. Architettura Generale

### Componenti

| Componente | Stack | Responsabilità |
|---|---|---|
| Web UI | React + Vite + TypeScript | Chat, player Strudel embedded, knob dinamici, recorder |
| Backend | Python 3.11 + FastAPI | WebSocket server, orchestrazione LangGraph |
| Agenti | LangGraph + LiteLLM | Pipeline multi-agente LLM-agnostica |
| File sync | Filesystem | Scrive `.strudel` su disco per ispezione VS Code |

### Comunicazione

```
Browser (UI) ←──WebSocket──→ FastAPI Backend ←──→ LangGraph Graph
                                    ↓
                              .strudel (file)
                                    ↓
                           VS Code + strudel-vscode (opzionale, solo ispezione)
```

Il **player Strudel è embedded nel browser** via `@strudel/web` — source of truth per l'audio. VS Code è opzionale per chi vuole ispezionare/editare manualmente il codice.

---

## 3. Grafo degli Agenti (LangGraph — Supervisor Pattern)

### Stato condiviso

```python
class MusicState(TypedDict):
    strudel_code: str           # codice .strudel corrente
    musical_context: dict       # {genre, mood, bpm, instruments, key, intensity}
    conversation_history: list  # messaggi utente + risposte agenti
    active_knobs: list          # [{name, min, max, value, strudel_param}]
    user_intent: str            # intent classificato dal Supervisor
    creative_mode: bool         # True quando l'utente cede controllo al Creative Agent
    next_agents: list           # agenti da invocare nel ciclo corrente
```

### Agenti (6 totali)

#### Supervisor
Entry point del grafo. Riceve ogni messaggio utente, classifica l'intent e determina la sequenza di agenti da attivare. Riconosce `creative_mode` quando l'utente dice "fai tu", "sorprendimi", "vai in autonomia".

**Intent classificati:**
- `modify_track` → Music Expert → Strudel Coder → Knobs Agent → Response Agent
- `move_knob` → Strudel Coder (solo, silenzioso)
- `chat` → Response Agent (solo)
- `creative_autonomous` → Creative Agent → Strudel Coder → Knobs Agent → Response Agent
- `creative_advice` → Creative Agent (advisor) → Response Agent
- `start_from_scratch` → Music Expert → Strudel Coder → Knobs Agent → Response Agent

#### Music Expert
Traduce linguaggio non tecnico in specifiche musicali strutturate.

Esempio: `"qualcosa di più aggressivo"` → `{increase_bpm: true, target_bpm: 140, mode: "minor", add: ["distortion", "kick_hard"], intensity: "high"}`

#### Creative Agent
Due modalità operative:
- **Advisor**: ascolta il contesto corrente e propone suggerimenti creativi proattivi all'utente
- **Autonomous**: quando `creative_mode=True`, compone una variazione completa della traccia in autonomia, iterando internamente fino a un risultato coerente, poi passa a Strudel Coder

Pensato per V2: in futuro può essere esteso per loop autonomi (architettura C — grafo reattivo).

#### Strudel Coder
Riceve specifiche musicali (da Music Expert o Creative Agent) e il codice corrente, genera codice Strudel valido e incrementale. Non riscrive mai da zero — applica diff chirurgici al codice esistente per garantire continuità durante la performance.

#### Knobs Agent
Analizza il codice Strudel corrente e identifica i parametri più significativi da esporre come knob interattivi. Genera la lista con:
- `name`: label human-readable
- `strudel_param`: parametro nel codice da modificare
- `min`, `max`, `value`: range sensato per il parametro
- `color`: colore suggerito per la UI

Si attiva ogni volta che il codice cambia significativamente.

#### Response Agent
Genera la risposta conversazionale per l'utente in linguaggio semplice e amichevole. Spiega cosa è cambiato, propone la prossima mossa, fa domande per guidare l'evoluzione della traccia. In `creative_mode`, racconta le scelte creative dell'agente autonomo.

---

## 4. Struttura Progetto

```
music/
├── .strudel                          ← file condiviso (agenti → VS Code)
├── backend/
│   ├── main.py                       ← FastAPI + WebSocket server
│   ├── graph.py                      ← LangGraph graph definition + routing
│   ├── state.py                      ← MusicState TypedDict
│   ├── config.yaml                   ← LLM provider config (LiteLLM)
│   ├── agents/
│   │   ├── supervisor.py
│   │   ├── music_expert.py
│   │   ├── strudel_coder.py
│   │   ├── knobs_agent.py
│   │   ├── creative_agent.py
│   │   └── response_agent.py
│   └── prompts/                      ← prompt YAML per ogni agente
│       ├── supervisor.yaml
│       ├── music_expert.yaml
│       ├── strudel_coder.yaml
│       ├── knobs_agent.yaml
│       ├── creative_agent.yaml
│       └── response_agent.yaml
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   └── components/
    │       ├── Chat.tsx              ← interfaccia conversazionale
    │       ├── StrudelPlayer.tsx     ← player embedded (@strudel/web)
    │       ├── KnobPanel.tsx         ← knob dinamici generati dagli agenti
    │       └── Recorder.tsx          ← registrazione performance (Web Audio API)
    ├── index.html
    └── package.json
```

---

## 5. Formato Prompt YAML

Ogni agente carica il proprio prompt da file YAML. I placeholder `{...}` vengono interpolati a runtime prima della chiamata LLM.

```yaml
# prompts/music_expert.yaml
system: |
  You are an expert musician and music theorist working as part of a multi-agent system.
  Your role is to translate non-technical user requests into precise musical specifications.
  Current musical context: {musical_context}
  Always respond in JSON format.

user: |
  The user said: "{user_message}"
  Current track context: {musical_context}
  Translate this into precise musical specifications as JSON.
```

---

## 6. UI Layout

Layout **B** — player e knob in alto, chat in basso.

```
┌─────────────────────────────────────────────┐
│  🎵 Strudel Player      │  🎛️ Knob Panel     │
│  [codice corrente]      │  BPM  LPF  Rev     │
│  [▶ Play] [⏹] [⏺ REC] │  Vol  Delay  +add  │
│  [waveform / progress]  │  (generati dagli   │
│                         │   agenti)          │
├─────────────────────────────────────────────┤
│  💬 Chat                                     │
│  🤖 Perfetto! Ho aggiunto riverbero...       │
│  👤 Sì, e metti qualcosa di più malinconico  │
│  ┌──────────────────────────┐  [→ Invia]    │
│  │ Descrivi cosa vuoi...    │               │
│  └──────────────────────────┘               │
└─────────────────────────────────────────────┘
```

**Knob panel:** i knob appaiono e scompaiono dinamicamente basandosi sul codice corrente. Ogni knob ha label, valore corrente e range. Muovere un knob invia un comando diretto a Strudel Coder (bypassando Music Expert per latenza minima).

---

## 7. Recording

Implementato interamente client-side via **Web Audio API** (`MediaRecorder`):

1. L'utente preme ⏺ REC
2. `MediaRecorder` cattura l'output audio del nodo Strudel player
3. L'utente preme ⏹ — il file `.webm` (o `.wav` con transcoding) viene scaricato automaticamente
4. Nessun overhead server — tutto nel browser

---

## 8. LLM Provider Abstraction (LiteLLM)

```yaml
# config.yaml
model: anthropic/claude-sonnet-4-6  # default

# Esempi alternativi:
# model: openai/gpt-4o
# model: openai/o3
# model: ollama/llama3.1
# model: anthropic/claude-haiku-4-5-20251001  # worker economico
```

Tutti gli agenti usano `litellm.completion()` — cambiare provider non richiede modifiche al codice, solo al config.

---

## 9. Flusso Real-time (WebSocket)

```
Client → WS → FastAPI → LangGraph.invoke(state) → [agenti] → stato aggiornato
                                                              ↓
Client ← WS ← {                                    FastAPI stream
  type: "code_update",    # nuovo codice Strudel
  code: "...",
  knobs: [...],           # nuovi knob
  message: "...",         # risposta testuale
  creative_mode: false
}
```

Il backend fa **streaming** degli aggiornamenti — il codice Strudel può essere inviato parzialmente mentre gli altri agenti completano, riducendo la latenza percepita.

---

## 10. V2 — Note per il futuro

- **Architettura C (Grafo Reattivo)**: quando il sistema è stabile, il Creative Agent può essere esteso con loop autonomi, dove gli agenti si coordinano senza input umano per evolvere la traccia in background.
- **MIDI output**: il Knobs Agent potrebbe mappare i knob su parametri MIDI per hardware fisico.
- **Multi-traccia**: estendere lo stato per gestire più tracce Strudel parallele (S1, S2, DRUMS già presenti nel file corrente).

---

## 11. Dipendenze principali

**Backend:**
```
langgraph>=0.2
langchain>=0.3
litellm>=1.40
fastapi>=0.111
uvicorn
pyyaml
```

**Frontend:**
```
react + vite
@strudel/web
typescript
```
