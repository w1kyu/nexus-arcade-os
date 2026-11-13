# AI Setup Guide

Nexus Arcade OS integrates with local or remote AI servers that you configure. It never fakes AI output or phones home.

## Local Ollama Setup

[Ollama](https://ollama.ai) lets you run open-source models like Llama 3, Mistral, Gemma, and Phi locally on your computer.

1. **Install Ollama:** Download and install Ollama from [ollama.ai](https://ollama.ai).
2. **Download a model:** Open your terminal and pull a model:
   ```bash
   ollama run llama3
   ollama pull nomic-embed-text
   ```
3. **Allow Browser Requests (`OLLAMA_ORIGINS`):** By default, Ollama restricts incoming origins. Allow Nexus by setting the environment variable:
   - **macOS / Linux:**
     ```bash
     OLLAMA_ORIGINS="*" ollama serve
     ```
   - **Windows:** Set `OLLAMA_ORIGINS` to `*` in your Environment Variables or run in PowerShell:
     ```powershell
     $env:OLLAMA_ORIGINS="*"
     ollama serve
     ```
4. **Configure in Nexus:** Go to **Settings → AI Workspace**, select **Local Ollama** (`http://localhost:11434`), and click **Test**.

## Lemonade & OpenAI-Compatible Servers

You can connect to **Lemonade**, **LM Studio**, **LocalAI**, **llama.cpp**, **vLLM**, or **OpenRouter**:

1. Start your local server with CORS enabled.
2. In LM Studio, start the Local Server on port `1234` with CORS turned ON.
3. In **Settings → AI Workspace**, enter the Base URL (e.g. `http://localhost:1234/v1`).
4. Click **Test** to discover available models.

## Anthropic Claude API

To connect to Anthropic's Messages API:

1. Obtain an API key from [console.anthropic.com](https://console.anthropic.com).
2. In **Settings → AI Workspace**, select **Anthropic Claude**.
3. Enter your API key. Keys are encrypted at rest with your device key and never sent to logs.

## Important Note on HTTPS and Mixed-Content

Web browsers enforce strict **Mixed-Content** security rules. If Nexus is loaded over HTTPS on the web:

- Connecting to `http://localhost:...` or `http://127.0.0.1:...` is allowed in most modern browsers.
- Connecting to an unencrypted `http://` server on **another machine** on your local network will be blocked by the browser. For remote network endpoints, use an HTTPS tunnel (e.g. Tailscale, Cloudflare Tunnel) or install Nexus locally as a PWA / run Nexus Lite from `file://`.
