# Spec: Spec Generator — AI-Powered Spec Builder para Claude Code

## Overview

Aplicação React single-page que guia o desenvolvedor na criação de especificações técnicas
estruturadas para serem consumidas por agentes de IA (Claude Code, GitHub Copilot Agent).

O fluxo é: formulário guiado em etapas → avaliação automática por LLM → geração de documento
`.md` pronto para ser colado no contexto do agente.

**Problema resolvido:** Desenvolvedores criam specs com lacunas que fazem o agente codificar
errado ou extrapolar o escopo. Esta ferramenta força o preenchimento estruturado e valida
completude antes de gerar o documento final.

**Usuário:** Desenvolvedor backend/AI Engineer em ambiente fintech (Brasil).

**Mudança v2:** A integração com LLM é configurável via painel de settings. Suporta
Anthropic API, OpenRouter e Ollama (modelos locais). Nenhuma configuração fica hardcoded.

---

## Stack & Constraints

- React (functional components + hooks)
- Tailwind utility classes apenas (sem compiler — usar só classes base do Tailwind CDN)
- Single file `.jsx` — sem separação de CSS ou arquivos auxiliares
- Sem `<form>` tags — usar `onClick` / `onChange`
- Sem `localStorage` ou `sessionStorage`
- Todo estado em memória via `useState`

---

## Interface Contract

### Componente principal
```
export default function SpecGenerator()
```
Sem props obrigatórias. Renderiza a aplicação completa.

### Estrutura de dados — estado central
```js
{
  // — Configuração do provider LLM —
  llmConfig: {
    provider: "anthropic" | "openrouter" | "ollama",
    apiKey: string,          // Anthropic ou OpenRouter; vazio para Ollama
    model: string,           // ex: "claude-sonnet-4-20250514", "mistral:latest"
    baseUrl: string,         // Ollama: "http://localhost:11434"; outros: ignorado
    maxTokens: number        // default 1000
  },

  // — Spec data —
  specType: "feature" | "service" | "integration" | "",

  system: {
    name: string,
    purpose: string,
    regulations: string[],
    stack: string
  },

  service: {
    name: string,
    responsibility: string,
    type: "API REST" | "Worker/Consumer" | "Scheduler" | "BFF" | "Gateway" | "",
    repo: string
  },

  feature: {
    name: string,
    problem: string,
    related: string,
    trigger: "Request HTTP" | "Evento de Fila" | "Scheduler/Cron" | "Chamada Interna" | "",
    volume: string
  },

  interface: {
    type: "HTTP Endpoint" | "Consumer de Evento" | "Task Agendada" | "Função Interna" | "",
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "",
    path: string,
    requestFields: string,
    responseSchema: string,
    errorCodes: string
  },

  rules: Array<{ name: string, condition: string, behavior: string }>,

  data: {
    readTables: string,
    writeTables: string,
    transactional: boolean,
    migrations: boolean
  },

  tests: Array<{ scenario: string, given: string, when: string, then: string }>,

  outOfScope: string,
  agentHints: string
}
```

### Valores padrão do llmConfig
```js
{
  provider: "anthropic",
  apiKey: "",
  model: "claude-sonnet-4-20250514",
  baseUrl: "http://localhost:11434",
  maxTokens: 1000
}
```

---

## Fluxo de Navegação (Steps)

```
STEPS = [
  { id: "type",      label: "Tipo de Spec" },
  { id: "system",    label: "Sistema" },
  { id: "service",   label: "Serviço" },
  { id: "feature",   label: "Feature" },
  { id: "interface", label: "Interface" },
  { id: "rules",     label: "Regras de Negócio" },
  { id: "data",      label: "Dados" },
  { id: "tests",     label: "Testes" },
  { id: "evaluate",  label: "Avaliar & Gerar" },
]
```

**Regras de navegação:**
- Step `type` não exibe barra de progresso nem botões Voltar/Próximo
- Ao selecionar um tipo em `type`, avança automaticamente para `system`
- Steps `system` até `evaluate` exibem barra de progresso e botões Voltar / Próximo
- O step `evaluate` não exibe botão "Próximo"
- `rules` e `tests` permitem adicionar/remover itens dinamicamente (mínimo 1)

**Settings:**
- Ícone ⚙ fixo no canto superior direito do header, visível em todos os steps
- Ao clicar, abre overlay de configuração do LLM sobre o conteúdo atual
- Fechar retorna ao step em que o usuário estava, sem perder dados

---

## Business Rules

### Regra 1: Seleção de Tipo
- Clicar em card de tipo define `specType` E avança automaticamente para `system`
- Tipos: FEATURE (⚡), SERVICE (🔧), INTEGRATION (🔗)

### Regra 2: Barra de Progresso
- Exibida apenas do step `system` em diante
- Segmentos preenchidos = steps já visitados + atual

### Regra 3: Provider Adapter — callLLM()
Função async declarada fora do componente. Assinatura:
```js
async function callLLM(systemPrompt, userPrompt, llmConfig): Promise<string>
```
Retorna texto da resposta. Lança `Error` em falha.

**Anthropic:**
```
POST https://api.anthropic.com/v1/messages
Headers: { "Content-Type": "application/json" }
  — adicionar "x-api-key": llmConfig.apiKey apenas quando apiKey não estiver vazio
Body: {
  model: llmConfig.model,
  max_tokens: llmConfig.maxTokens,
  system: systemPrompt,
  messages: [{ role: "user", content: userPrompt }]
}
Extração: data.content.map(c => c.text || "").join("")
```

**OpenRouter:**
```
POST https://openrouter.ai/api/v1/chat/completions
Headers: {
  "Content-Type": "application/json",
  "Authorization": "Bearer " + llmConfig.apiKey
}
Body: {
  model: llmConfig.model,
  max_tokens: llmConfig.maxTokens,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user",   content: userPrompt }
  ]
}
Extração: data.choices[0].message.content
```

**Ollama:**
```
POST {llmConfig.baseUrl}/api/chat
Headers: { "Content-Type": "application/json" }
Body: {
  model: llmConfig.model,
  stream: false,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user",   content: userPrompt }
  ]
}
Extração: data.message.content
```

### Regra 4: Validação antes de chamar LLM
Verificar em ordem antes de qualquer chamada:
1. `model` vazio → `"Configure o modelo nas configurações (⚙)"`
2. provider = "openrouter" e `apiKey` vazio → `"Configure a API Key do OpenRouter nas configurações (⚙)"`
3. provider = "ollama" e `baseUrl` vazio → `"Configure a URL do Ollama nas configurações (⚙)"`

Erros exibidos no espaço de erros do step evaluate.
NÃO abrir painel de settings automaticamente.

### Regra 5: Painel de Settings
Campos por provider:

| Campo      | Anthropic | OpenRouter  | Ollama |
|------------|-----------|-------------|--------|
| Provider   | ✓ toggle  | ✓ toggle    | ✓ toggle |
| API Key    | opcional  | obrigatório | —      |
| Model      | ✓         | ✓           | ✓      |
| Base URL   | —         | —           | ✓      |
| Max Tokens | ✓         | ✓           | ✓      |

**Modelos sugeridos** (via `<datalist>` — campo continua livre para digitar):
```js
anthropic:  ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-4-5-20251001"]
openrouter: ["moonshotai/kimi-k2", "minimax/minimax-m1", "google/gemini-2.5-pro", "meta-llama/llama-3.3-70b-instruct"]
ollama:     ["llama3.2", "mistral", "gemma3", "qwen2.5-coder", "deepseek-r1"]
```

Ao trocar provider: atualizar `llmConfig.model` para o primeiro modelo da nova lista.

**API Key:** `type="password"` com botão toggle mostrar/ocultar (👁 / 🔒).

**Indicador de status no header:**
- Pill ao lado do ⚙, sempre visível
- Formato: `{provider} · {model truncado em 20 chars}`
- Estilo: fundo `#1a3a2a`, borda `#2d6a4f`, texto `#74c69d`, `fontSize: 11`

### Regra 6: Avaliação por LLM
- Chama `callLLM(systemPrompt, buildSpecText(data), llmConfig)`
- System prompt: retornar apenas JSON válido, sem markdown, sem texto extra
- Response JSON esperado:
```json
{
  "score_geral": 0-10,
  "dimensoes": {
    "contexto":       { "score": 0-10, "lacunas": ["..."] },
    "interface":      { "score": 0-10, "lacunas": ["..."] },
    "regras_negocio": { "score": 0-10, "lacunas": ["..."] },
    "dados":          { "score": 0-10, "lacunas": ["..."] },
    "testes":         { "score": 0-10, "lacunas": ["..."] },
    "tecnico":        { "score": 0-10, "lacunas": ["..."] }
  },
  "ambiguidades": ["..."],
  "perguntas_pendentes": ["..."],
  "pronta_para_agente": true | false
}
```
- Parse após remover fences ` ```json ``` `

### Regra 7: Geração do .md
- Chama `callLLM(systemPrompt, buildSpecText(data), llmConfig)`
- System prompt: Markdown completo para Claude Code com seções
  `Overview`, `Interface Contract`, `Business Rules`, `Data Layer`,
  `Technical Constraints`, `Acceptance Criteria`, `Agent Hints`
- Resultado em `<pre>` com botão "Copiar" via `navigator.clipboard.writeText`

### Regra 8: Tabs no step evaluate
- "Avaliar" → tab "Avaliação" disponível; "Gerar .md" → tab "Spec .md" disponível
- Ambas coexistem; tab ativa = última ação executada

### Regra 9: Score color coding
- >= 8 → `#52b788` | >= 5 → `#f4a261` | < 5 → `#e63946`

### Regra 10: Loading state
- Chamada em curso: botões `disabled`, cursor `wait`, opacidade 0.6
- `loading` boolean global

### Regra 11: buildSpecText(data)
- Função pura, fora do componente, recebe estado como argumento
- Seções em maiúsculas, fields `label: valor`, rules/tests numerados
- Não inclui dados de `llmConfig`

---

## Visual Design

**Tema:** Terminal / fintech — escuro, monocromático verde, monospace

**Paleta:**
```
background:   #060e09   surface:     #0d1f14   surface-alt: #0a1a10
border:       #1e4028   border-act:  #2d6a4f
text-primary: #c8e6c9   text-sec:    #a8d5b5   text-muted:  #4a7a5a
accent:       #74c69d   accent-str:  #52b788
warning:      #f4a261   error:       #e63946
```

**Tipografia:** `'IBM Plex Mono', 'JetBrains Mono', monospace`

**Painel de Settings:**
- Overlay: `position: fixed`, inset 0, `rgba(6,14,9,0.92)`, `zIndex: 100`
- Painel: centralizado, `maxWidth: 480px`, fundo `#0d1f14`, borda `#1e4028`, `borderRadius: 12`, padding 24
- Header: "Configuração do LLM" + botão × fechar
- Provider: 3 botões toggle lado a lado
- Campos condicionais via ternário

**Demais padrões visuais idênticos à v1** (inputStyle, textareaStyle, Field, botões).

---

## Data Layer

Sem persistência. Todo estado em `useState`.

Endpoints configuráveis via `llmConfig`:
- `https://api.anthropic.com/v1/messages`
- `https://openrouter.ai/api/v1/chat/completions`
- `{llmConfig.baseUrl}/api/chat`

---

## Technical Constraints

- Single `.jsx`, CSS inline
- `box-sizing: border-box` em todos os inputs
- Scroll ao topo entre steps via `useRef` + `scrollIntoView`
- `maxWidth: 680px`, `padding: 0 16px 80px`
- Sem `<form>`, sem `localStorage`, sem bibliotecas extras
- Settings overlay: `position: fixed`, não causa scroll
- Textarea spec: `maxHeight: 500px`, `overflowY: auto`, monospace

---

## Acceptance Criteria

**Cenário 1 — Anthropic sem API Key (claude.ai)**
- Given: provider="anthropic", apiKey=""
- When: clica "Avaliar Spec"
- Then: chamada sem header x-api-key, resposta processada normalmente

**Cenário 2 — OpenRouter sem API Key**
- Given: provider="openrouter", apiKey=""
- When: clica "Avaliar Spec"
- Then: mensagem de erro exibida, nenhuma chamada HTTP feita

**Cenário 3 — Ollama local**
- Given: provider="ollama", baseUrl="http://localhost:11434", model="llama3.2"
- When: clica "Gerar .md"
- Then: POST para `http://localhost:11434/api/chat` com `stream:false`, resposta exibida

**Cenário 4 — Troca de provider**
- Given: painel aberto, provider="anthropic"
- When: clica "OpenRouter"
- Then: campo API Key aparece, Base URL some, modelos atualizam, model = primeiro da lista

**Cenário 5 — Indicador de status**
- Given: provider="ollama", model="qwen2.5-coder"
- When: qualquer step
- Then: pill exibe "ollama · qwen2.5-coder"

**Cenário 6 — Happy path**
- Given: campos preenchidos, LLM configurado
- When: clica "Avaliar Spec"
- Then: JSON parseado, scores por dimensão, badge correto

**Cenário 7 — Geração do .md**
- Given: campos preenchidos, LLM configurado
- When: clica "Gerar .md"
- Then: Markdown em `<pre>`, "Copiar" funciona

**Cenário 8 — Regras dinâmicas**
- Given: step "rules", 1 regra
- When: adiciona / remove
- Then: mínimo de 1 mantido

**Cenário 9 — Erro de rede**
- Given: LLM inacessível
- When: clica qualquer botão de ação
- Then: erro amigável, loading encerrado, botões reabilitados

---

## Agent Hints

### Arquivos a criar
```
spec-generator.jsx   ← componente único, export default SpecGenerator
```

### Padrões obrigatórios
- `callLLM(systemPrompt, userPrompt, llmConfig)` — async, fora do componente
- `buildSpecText(data)` — pura, fora do componente
- `set(path, value)` — dentro do componente, dot notation
- `showSettings` — boolean `useState` para o overlay
- `llmConfig` — slice separado do estado da spec

### Ordem de implementação sugerida
1. Estado + `set()` + `llmConfig` inicial
2. `callLLM()` com os 3 adapters
3. `buildSpecText()`
4. Steps do formulário (type → tests)
5. Step evaluate (handleEvaluate + handleGenerate)
6. Painel de Settings (overlay + campos condicionais + datalist)
7. Indicador de status no header

### O que NÃO fazer
- Não hardcodar URL, modelo, apiKey ou baseUrl em nenhum lugar
- Não separar em múltiplos arquivos
- Não salvar `llmConfig` em nenhum storage
- Não usar `<form>` ou `<input type="submit">`
- Não abrir settings automaticamente em erro de validação
- Não exibir API Key sem toggle explícito do usuário
- Não chamar `callLLM()` sem passar `llmConfig` como argumento
- Não adicionar steps além dos 9 definidos