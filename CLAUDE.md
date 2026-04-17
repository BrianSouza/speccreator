# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (Vite, default port 5173)
npm run build    # production build
npm run preview  # preview production build
```

No test runner or linter is configured.

## Architecture

This is a single-page React app that guides developers through creating structured technical specs for AI coding agents. The workflow: multi-step form → LLM evaluation (scoring gaps) → Markdown spec generation (ready to paste as agent context).

### Hard constraints from spec.md

- **Single file**: all app logic lives in `spec-generator.jsx`. Do not split into multiple files.
- **Inline CSS only**: no Tailwind, no CSS files, no CSS-in-JS libraries. All styles are inline object literals using the `C` palette constant.
- **No `<form>` tags**: use `onClick`/`onChange` handlers.
- **No persistence**: no `localStorage`, `sessionStorage`, or cookies. All state is in `useState`.
- **No extra dependencies**: the only runtime deps are React and ReactDOM.

### Key functions (outside the component)

- `callLLM(systemPrompt, userPrompt, llmConfig)` — async adapter for three providers: Anthropic (`/v1/messages`), OpenRouter (`/v1/chat/completions`), and Ollama (`{baseUrl}/api/chat`). Must remain outside the component and receive `llmConfig` as an argument — never read it from closure.
- `buildSpecText(data)` — pure function that serializes the form state into a plain-text block sent to the LLM. Does not include `llmConfig` data.

### Component structure (`SpecGenerator`)

State is split into two slices: `llmConfig` (provider/model/key settings) and `data` (the spec being built). The `set(dotPath, value)` helper does immutable deep updates on `data` using dot-notation paths (e.g. `set("system.name", value)`).

Navigation is driven by a `STEPS` array (9 steps: `type → system → service → feature → interface → rules → data → tests → evaluate`). Step renderers are plain functions declared inside the component and dispatched via `stepRenderers[currentStep]()`. The `rules` and `tests` steps support dynamic add/remove with a minimum of 1 item.

The final step (`evaluate`) has two actions: **Avaliar Spec** (calls LLM, expects a JSON evaluation with dimension scores) and **Gerar .md** (calls LLM, expects Markdown). Results appear in tabs. The JSON response from evaluation must be stripped of markdown fences before `JSON.parse`.

### LLM validation order

Before any LLM call, `validateLLM()` checks in this order:
1. `model` empty → error
2. provider is `openrouter` and `apiKey` empty → error
3. provider is `ollama` and `baseUrl` empty → error

Errors are shown in the evaluate step UI. Settings overlay is never opened automatically.

### Visual design tokens

All colors are in the `C` constant at the top of `spec-generator.jsx`. Font is `'IBM Plex Mono', 'JetBrains Mono', monospace` (stored in `FONT`). Score color coding: ≥8 → `accentStr`, ≥5 → `warning`, <5 → `error`.
