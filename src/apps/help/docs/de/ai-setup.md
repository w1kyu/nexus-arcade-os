# KI-Einrichtungsleitfaden

Nexus Arcade OS verbindet sich direkt mit lokalen oder Remote-KI-Servern, die Sie selbst konfigurieren. Antworten werden niemals vorgetäuscht oder an Telemetrieserver gesendet.

## Lokale Einrichtung mit Ollama

[Ollama](https://ollama.ai) ermöglicht das lokale Ausführen von Open-Source-Modellen wie Llama 3, Mistral, Gemma und Phi.

1. **Ollama installieren:** Laden Sie Ollama von [ollama.ai](https://ollama.ai) herunter.
2. **Modell laden:** Öffnen Sie ein Terminal und laden Sie ein Modell:
   ```bash
   ollama run llama3
   ollama pull nomic-embed-text
   ```
3. **Browser-Anfragen erlauben (`OLLAMA_ORIGINS`):** Standardmäßig blockiert Ollama browserbasierte Anfragen. Setzen Sie die Umgebungsvariable:
   - **macOS / Linux:**
     ```bash
     OLLAMA_ORIGINS="*" ollama serve
     ```
   - **Windows (PowerShell):**
     ```powershell
     $env:OLLAMA_ORIGINS="*"
     ollama serve
     ```
4. **In Nexus konfigurieren:** Öffnen Sie **Einstellungen → KI-Arbeitsbereich**, wählen Sie **Local Ollama** (`http://localhost:11434`) und klicken Sie auf **Testen**.

## Lemonade & OpenAI-kompatible Server

Sie können beliebige OpenAI-kompatible Server wie **Lemonade**, **LM Studio**, **LocalAI**, **llama.cpp** oder **OpenRouter** nutzen:

1. Starten Sie Ihren Server mit aktiviertem CORS.
2. Geben Sie in **Einstellungen → KI-Arbeitsbereich** die Basis-URL ein (z. B. `http://localhost:1234/v1`).
3. Klicken Sie auf **Testen**, um verfügbare Modelle abzurufen.

## Anthropic Claude API

1. Erstellen Sie einen API-Schlüssel auf [console.anthropic.com](https://console.anthropic.com).
2. Wählen Sie in den **Einstellungen → KI-Arbeitsbereich** **Anthropic Claude**.
3. Geben Sie Ihren API-Schlüssel ein. Schlüssel werden lokal auf dem Gerät verschlüsselt gespeichert.

## Hinweis zu HTTPS und Mixed-Content

Moderne Webbrowser blockieren aus Sicherheitsgründen HTTP-Verbindungen zu anderen Rechnern, wenn Nexus über HTTPS geladen wird (Mixed Content). Verbindungen zu `http://localhost:...` sind erlaubt. Verwenden Sie für entfernte Maschinen einen HTTPS-Tunnel oder führen Sie Nexus Lite lokal aus.
