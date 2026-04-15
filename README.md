# Spec Generator

Aplicação React para criação de especificações técnicas estruturadas para agentes de IA (Claude Code, GitHub Copilot Agent).

O fluxo guiado em etapas força o preenchimento de todos os campos relevantes e valida a completude via LLM antes de gerar o documento `.md` final — eliminando as lacunas que fazem agentes codificar errado ou extrapolar escopo.

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- npm 9 ou superior

## Instalação

```bash
git clone <url-do-repositório>
cd spec-creator
npm install
```

## Executando

```bash
npm run dev
```

Acesse **http://localhost:5173** no browser.

```bash
# Build para produção
npm run build

# Preview do build
npm run preview
```

## Configuração do LLM

A integração com LLM é feita **em tempo de execução** via painel de configurações — nenhuma chave fica no código ou em arquivos de ambiente.

Clique no ícone **⚙** no canto superior direito e preencha conforme o provider escolhido:

### Anthropic (padrão)

| Campo      | Valor                          |
|------------|-------------------------------|
| Provider   | `anthropic`                   |
| API Key    | Opcional — se omitida, usa o crédito do claude.ai |
| Modelo     | `claude-sonnet-4-20250514` (sugerido) |
| Max Tokens | `1000` (padrão)               |

> **Nota:** Para uso via claude.ai sem API Key própria, deixe o campo vazio.

### OpenRouter

| Campo      | Valor                                     |
|------------|------------------------------------------|
| Provider   | `openrouter`                             |
| API Key    | **Obrigatório** — obtenha em [openrouter.ai/keys](https://openrouter.ai/keys) |
| Modelo     | `moonshotai/kimi-k2`, `google/gemini-2.5-pro`, etc. |
| Max Tokens | `1000` (padrão)                          |

### Ollama (modelos locais)

| Campo      | Valor                          |
|------------|-------------------------------|
| Provider   | `ollama`                      |
| Base URL   | `http://localhost:11434`       |
| Modelo     | `llama3.2`, `mistral`, `qwen2.5-coder`, etc. |
| Max Tokens | `1000` (padrão)               |

Certifique-se de que o Ollama está rodando localmente com o modelo baixado:

```bash
ollama pull llama3.2
ollama serve
```

## Fluxo de uso

1. **Selecione o tipo** de spec: Feature, Service ou Integration
2. Preencha os **9 steps** do formulário guiado
3. No último step, clique em **"Avaliar Spec"** para receber um score por dimensão (contexto, interface, regras, dados, testes, técnico)
4. Ajuste os campos conforme as lacunas apontadas
5. Clique em **"Gerar .md"** para obter o documento pronto para colar no contexto do agente

## Segurança

- Nenhuma API Key é persistida — tudo fica em memória e é descartado ao fechar o browser
- Não use `localStorage` ou `sessionStorage` para armazenar chaves (o projeto não faz isso por design)
- O arquivo `.gitignore` já exclui `.env*` e `node_modules/` — nunca commite chaves em arquivos de variáveis de ambiente
