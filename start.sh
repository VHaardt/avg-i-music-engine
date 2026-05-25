#!/bin/bash
# Avvia Music Multi-Agent System (macOS)

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Music Multi-Agent System ==="

# 1. Ollama (solo se il modello configurato usa ollama/)
MODEL=$(grep -E '^\s*model:' "$ROOT/backend/config.yaml" | grep -v '^\s*#' | head -1 | sed 's/.*model: *"\(.*\)".*/\1/')
if [[ "$MODEL" == ollama/* ]]; then
    if pgrep -x ollama > /dev/null; then
        echo "✓ Ollama già in esecuzione"
    else
        echo "→ Avvio Ollama (modello: $MODEL)..."
        osascript -e "tell application \"Terminal\"
            do script \"ollama serve\"
            set custom title of front window to \"Ollama\"
        end tell"
        sleep 2
    fi
else
    echo "→ Modello API ($MODEL) — Ollama non avviato"
fi

# 2. Libera porta 8000 se occupata
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "→ Porta 8000 occupata, libero..."
    lsof -ti:8000 | xargs kill -9
    sleep 1
fi

# 3. Backend (uvicorn) — apre una nuova finestra Terminal
echo "→ Avvio Backend..."
osascript -e "tell application \"Terminal\"
    do script \"cd '$ROOT' && source backend/.venv/bin/activate && uvicorn backend.main:app --port 8000\"
    set custom title of front window to \"Backend\"
end tell"

sleep 2

# 3. Frontend (Vite) — apre un'altra finestra Terminal
echo "→ Avvio Frontend..."
osascript -e "tell application \"Terminal\"
    do script \"cd '$ROOT/frontend' && npm run dev\"
    set custom title of front window to \"Frontend\"
end tell"

# 4. Attendi che il frontend sia pronto e apri il browser
echo "→ Attendo avvio server..."
sleep 5
open "http://localhost:5173"

echo "✓ Fatto! Browser aperto su http://localhost:5173"
