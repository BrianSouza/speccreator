import { useState, useRef } from "react";

// ---- Paleta e constantes ----
const C = {
  bg: "#060e09",
  surface: "#0d1f14",
  surfaceAlt: "#0a1a10",
  border: "#1e4028",
  borderAct: "#2d6a4f",
  textPrimary: "#c8e6c9",
  textSec: "#a8d5b5",
  textMuted: "#4a7a5a",
  accent: "#74c69d",
  accentStr: "#52b788",
  warning: "#f4a261",
  error: "#e63946",
};

const FONT = "'IBM Plex Mono', 'JetBrains Mono', monospace";

const STEPS = [
  { id: "type",      label: "Tipo de Spec" },
  { id: "system",    label: "Sistema" },
  { id: "service",   label: "Serviço" },
  { id: "feature",   label: "Feature" },
  { id: "interface", label: "Interface" },
  { id: "rules",     label: "Regras de Negócio" },
  { id: "data",      label: "Dados" },
  { id: "tests",     label: "Testes" },
  { id: "evaluate",  label: "Avaliar & Gerar" },
];

const MODELS = {
  anthropic:  ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-4-5-20251001"],
  openrouter: ["moonshotai/kimi-k2", "minimax/minimax-m1", "google/gemini-2.5-pro", "meta-llama/llama-3.3-70b-instruct"],
  ollama:     ["llama3.2", "mistral", "gemma3", "qwen2.5-coder", "deepseek-r1"],
};

// ---- Estilos e componentes de UI (fora do componente para evitar remount a cada render) ----

const inputStyle = {
  background: C.surfaceAlt,
  border: `1px solid ${C.border}`,
  color: C.textPrimary,
  fontFamily: FONT,
  fontSize: 13,
  padding: "8px 12px",
  borderRadius: 6,
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
};
const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 80,
};
const selectStyle = { ...inputStyle, cursor: "pointer" };
const labelStyle  = {
  display: "block",
  color: C.textMuted,
  fontSize: 11,
  fontFamily: FONT,
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};
const fieldStyle = { marginBottom: 16 };

function Field({ label, children }) {
  return (
    <div style={fieldStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ---- Funções puras fora do componente ----

async function callLLM(systemPrompt, userPrompt, llmConfig) {
  const { provider, apiKey, model, baseUrl, maxTokens } = llmConfig;

  if (provider === "anthropic") {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["x-api-key"] = apiKey;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Anthropic error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    return data.content.map((c) => c.text || "").join("");
  }

  if (provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider === "ollama") {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Ollama error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    return data.message.content;
  }

  throw new Error("Provider desconhecido");
}

function buildSpecText(data) {
  const lines = [];
  lines.push(`TIPO DE SPEC: ${data.specType}`);
  lines.push("");
  lines.push("SISTEMA:");
  lines.push(`  Nome: ${data.system.name}`);
  lines.push(`  Propósito: ${data.system.purpose}`);
  lines.push(`  Regulações: ${(data.system.regulations || []).join(", ")}`);
  lines.push(`  Stack: ${data.system.stack}`);
  lines.push("");
  lines.push("SERVIÇO:");
  lines.push(`  Nome: ${data.service.name}`);
  lines.push(`  Responsabilidade: ${data.service.responsibility}`);
  lines.push(`  Tipo: ${data.service.type}`);
  lines.push(`  Repositório: ${data.service.repo}`);
  lines.push("");
  lines.push("FEATURE:");
  lines.push(`  Nome: ${data.feature.name}`);
  lines.push(`  Problema: ${data.feature.problem}`);
  lines.push(`  Relacionada a: ${data.feature.related}`);
  lines.push(`  Trigger: ${data.feature.trigger}`);
  lines.push(`  Volume: ${data.feature.volume}`);
  lines.push("");
  lines.push("INTERFACE:");
  lines.push(`  Tipo: ${data.interface.type}`);
  lines.push(`  Método: ${data.interface.method}`);
  lines.push(`  Path: ${data.interface.path}`);
  lines.push(`  Campos de Requisição: ${data.interface.requestFields}`);
  lines.push(`  Schema de Resposta: ${data.interface.responseSchema}`);
  lines.push(`  Códigos de Erro: ${data.interface.errorCodes}`);
  lines.push("");
  lines.push("REGRAS DE NEGÓCIO:");
  (data.rules || []).forEach((r, i) => {
    lines.push(`  ${i + 1}. ${r.name}`);
    lines.push(`     Condição: ${r.condition}`);
    lines.push(`     Comportamento: ${r.behavior}`);
  });
  lines.push("");
  lines.push("DADOS:");
  lines.push(`  Tabelas de Leitura: ${data.data.readTables}`);
  lines.push(`  Tabelas de Escrita: ${data.data.writeTables}`);
  lines.push(`  Transacional: ${data.data.transactional ? "Sim" : "Não"}`);
  lines.push(`  Migrations: ${data.data.migrations ? "Sim" : "Não"}`);
  lines.push("");
  lines.push("TESTES:");
  (data.tests || []).forEach((t, i) => {
    lines.push(`  ${i + 1}. ${t.scenario}`);
    lines.push(`     Given: ${t.given}`);
    lines.push(`     When: ${t.when}`);
    lines.push(`     Then: ${t.then}`);
  });
  lines.push("");
  lines.push(`FORA DO ESCOPO: ${data.outOfScope}`);
  lines.push(`DICAS PARA AGENTE: ${data.agentHints}`);
  return lines.join("\n");
}

// ---- Componente principal ----

export default function SpecGenerator() {
  const topRef = useRef(null);

  const [currentStep, setCurrentStep] = useState("type");
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [evalResult, setEvalResult]     = useState(null);
  const [specMd, setSpecMd]             = useState("");
  const [activeTab, setActiveTab]       = useState("evaluate");
  const [showApiKey, setShowApiKey]     = useState(false);
  const [copied, setCopied]             = useState(false);

  const [llmConfig, setLlmConfig] = useState({
    provider: "anthropic",
    apiKey: "",
    model: "claude-sonnet-4-20250514",
    baseUrl: "http://localhost:11434",
    maxTokens: 1000,
  });

  const [data, setData] = useState({
    specType: "",
    system:    { name: "", purpose: "", regulations: [], stack: "" },
    service:   { name: "", responsibility: "", type: "", repo: "" },
    feature:   { name: "", problem: "", related: "", trigger: "", volume: "" },
    interface: { type: "", method: "", path: "", requestFields: "", responseSchema: "", errorCodes: "" },
    rules:     [{ name: "", condition: "", behavior: "" }],
    data:      { readTables: "", writeTables: "", transactional: false, migrations: false },
    tests:     [{ scenario: "", given: "", when: "", then: "" }],
    outOfScope: "",
    agentHints: "",
  });

  // dot-notation setter
  function set(path, value) {
    const keys = path.split(".");
    setData((prev) => {
      const next = { ...prev };
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = Array.isArray(cur[keys[i]])
          ? [...cur[keys[i]]]
          : { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  }

  function goToStep(id) {
    setCurrentStep(id);
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const stepIds    = STEPS.map((s) => s.id);
  const currentIdx = stepIds.indexOf(currentStep);
  const progressSteps = STEPS.filter((s) => s.id !== "type");
  const progressIdx   = progressSteps.findIndex((s) => s.id === currentStep);

  function handleNext() {
    if (currentIdx < stepIds.length - 1) goToStep(stepIds[currentIdx + 1]);
  }
  function handleBack() {
    if (currentIdx > 0) goToStep(stepIds[currentIdx - 1]);
  }

  function validateLLM() {
    const { provider, apiKey, model, baseUrl } = llmConfig;
    if (!model)
      return "Configure o modelo nas configurações (⚙)";
    if (provider === "openrouter" && !apiKey)
      return "Configure a API Key do OpenRouter nas configurações (⚙)";
    if (provider === "ollama" && !baseUrl)
      return "Configure a URL do Ollama nas configurações (⚙)";
    return null;
  }

  async function handleEvaluate() {
    const err = validateLLM();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    setActiveTab("evaluate");
    try {
      const systemPrompt = `Você é um avaliador de especificações técnicas para agentes de IA.
Avalie a spec fornecida e retorne APENAS um JSON válido, sem markdown, sem texto extra, com o seguinte formato:
{
  "score_geral": <0-10>,
  "dimensoes": {
    "contexto":       { "score": <0-10>, "lacunas": ["..."] },
    "interface":      { "score": <0-10>, "lacunas": ["..."] },
    "regras_negocio": { "score": <0-10>, "lacunas": ["..."] },
    "dados":          { "score": <0-10>, "lacunas": ["..."] },
    "testes":         { "score": <0-10>, "lacunas": ["..."] },
    "tecnico":        { "score": <0-10>, "lacunas": ["..."] }
  },
  "ambiguidades": ["..."],
  "perguntas_pendentes": ["..."],
  "pronta_para_agente": true
}`;
      const raw   = await callLLM(systemPrompt, buildSpecText(data), llmConfig);
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      setEvalResult(JSON.parse(clean));
    } catch (e) {
      setError(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    const err = validateLLM();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    setActiveTab("spec");
    try {
      const systemPrompt = `Você é um gerador de especificações técnicas para Claude Code.
Com base nas informações fornecidas, gere um documento Markdown completo e estruturado com as seções:
# Overview
# Interface Contract
# Business Rules
# Data Layer
# Technical Constraints
# Acceptance Criteria
# Agent Hints

O documento deve ser direto ao ponto, sem repetições, pronto para ser colado no contexto do agente.`;
      const md = await callLLM(systemPrompt, buildSpecText(data), llmConfig);
      setSpecMd(md);
    } catch (e) {
      setError(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(specMd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function scoreColor(s) {
    if (s >= 8) return C.accentStr;
    if (s >= 5) return C.warning;
    return C.error;
  }

  const truncModel = (llmConfig.model || "").length > 20
    ? (llmConfig.model || "").slice(0, 20) + "…"
    : (llmConfig.model || "");

  // ---- Painel de Settings ----
  function SettingsPanel() {
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: "rgba(6,14,9,0.92)",
        zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}>
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 24,
          maxWidth: 480,
          width: "100%",
          fontFamily: FONT,
          color: C.textPrimary,
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>Configuração do LLM</span>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                background: "none", border: "none", color: C.textMuted,
                cursor: "pointer", fontSize: 20, fontFamily: FONT, lineHeight: 1,
                padding: "0 4px",
              }}
            >×</button>
          </div>

          {/* Provider toggle */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Provider</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["anthropic", "openrouter", "ollama"].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    const newModel = MODELS[p][0];
                    setLlmConfig((prev) => ({ ...prev, provider: p, model: newModel }));
                  }}
                  style={{
                    flex: 1,
                    padding: "7px 0",
                    background: llmConfig.provider === p ? C.borderAct : C.surfaceAlt,
                    border: `1px solid ${llmConfig.provider === p ? C.accentStr : C.border}`,
                    color: llmConfig.provider === p ? C.accent : C.textMuted,
                    borderRadius: 6,
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: 12,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* API Key — anthropic=opcional, openrouter=obrigatório, ollama=oculto */}
          {llmConfig.provider !== "ollama" && (
            <div style={fieldStyle}>
              <label style={labelStyle}>
                API Key{llmConfig.provider === "openrouter" ? " (obrigatório)" : " (opcional)"}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showApiKey ? "text" : "password"}
                  value={llmConfig.apiKey}
                  onChange={(e) => setLlmConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                  style={{ ...inputStyle, paddingRight: 40 }}
                  placeholder="sk-..."
                />
                <button
                  onClick={() => setShowApiKey((v) => !v)}
                  style={{
                    position: "absolute", right: 8, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none",
                    cursor: "pointer", fontSize: 14, color: C.textMuted,
                    lineHeight: 1,
                  }}
                >
                  {showApiKey ? "👁" : "🔒"}
                </button>
              </div>
            </div>
          )}

          {/* Model com datalist */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Modelo</label>
            <input
              list="model-suggestions"
              value={llmConfig.model}
              onChange={(e) => setLlmConfig((prev) => ({ ...prev, model: e.target.value }))}
              style={inputStyle}
              placeholder="ex: claude-sonnet-4-20250514"
            />
            <datalist id="model-suggestions">
              {MODELS[llmConfig.provider].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          {/* Base URL — apenas Ollama */}
          {llmConfig.provider === "ollama" && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Base URL</label>
              <input
                value={llmConfig.baseUrl}
                onChange={(e) => setLlmConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
                style={inputStyle}
                placeholder="http://localhost:11434"
              />
            </div>
          )}

          {/* Max Tokens */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Max Tokens</label>
            <input
              type="number"
              value={llmConfig.maxTokens}
              onChange={(e) => setLlmConfig((prev) => ({ ...prev, maxTokens: Number(e.target.value) }))}
              style={inputStyle}
              min={100}
              max={8000}
            />
          </div>

          <button
            onClick={() => setShowSettings(false)}
            style={{
              width: "100%",
              padding: "10px 0",
              background: C.borderAct,
              border: `1px solid ${C.accentStr}`,
              color: C.accent,
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: FONT,
              fontSize: 13,
              marginTop: 4,
            }}
          >
            Salvar e Fechar
          </button>
        </div>
      </div>
    );
  }

  // ---- Renderers de steps ----

  function renderType() {
    const types = [
      { id: "feature",     icon: "⚡", label: "FEATURE",     desc: "Nova funcionalidade dentro de um serviço existente" },
      { id: "service",     icon: "🔧", label: "SERVICE",     desc: "Novo microsserviço ou componente do sistema" },
      { id: "integration", icon: "🔗", label: "INTEGRATION", desc: "Integração com sistema externo ou third-party" },
    ];
    return (
      <div>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ color: C.accent, fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            Spec Generator
          </div>
          <div style={{ color: C.textMuted, fontSize: 12 }}>
            Selecione o tipo de especificação para começar
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                set("specType", t.id);
                goToStep("system");
              }}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "20px 24px",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: FONT,
                display: "flex",
                alignItems: "center",
                gap: 16,
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accentStr)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
            >
              <span style={{ fontSize: 28 }}>{t.icon}</span>
              <div>
                <div style={{ color: C.accent, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t.label}</div>
                <div style={{ color: C.textMuted, fontSize: 12 }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderSystem() {
    return (
      <div>
        <h2 style={{ color: C.accent, fontSize: 16, marginBottom: 20, marginTop: 0 }}>Sistema</h2>
        <Field label="Nome do Sistema">
          <input
            value={data.system.name}
            onChange={(e) => set("system.name", e.target.value)}
            style={inputStyle}
            placeholder="ex: Plataforma de Pagamentos"
          />
        </Field>
        <Field label="Propósito">
          <textarea
            value={data.system.purpose}
            onChange={(e) => set("system.purpose", e.target.value)}
            style={textareaStyle}
            placeholder="O que este sistema faz e para quem"
          />
        </Field>
        <Field label="Regulações / Compliance">
          <input
            value={data.system.regulations.join(", ")}
            onChange={(e) =>
              set("system.regulations", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
            }
            style={inputStyle}
            placeholder="ex: PCI-DSS, LGPD, SOX"
          />
        </Field>
        <Field label="Stack Tecnológico">
          <input
            value={data.system.stack}
            onChange={(e) => set("system.stack", e.target.value)}
            style={inputStyle}
            placeholder="ex: Java 17, Spring Boot, PostgreSQL, Kafka"
          />
        </Field>
      </div>
    );
  }

  function renderService() {
    const serviceTypes = ["API REST", "Worker/Consumer", "Scheduler", "BFF", "Gateway"];
    return (
      <div>
        <h2 style={{ color: C.accent, fontSize: 16, marginBottom: 20, marginTop: 0 }}>Serviço</h2>
        <Field label="Nome do Serviço">
          <input
            value={data.service.name}
            onChange={(e) => set("service.name", e.target.value)}
            style={inputStyle}
            placeholder="ex: payment-service"
          />
        </Field>
        <Field label="Responsabilidade">
          <textarea
            value={data.service.responsibility}
            onChange={(e) => set("service.responsibility", e.target.value)}
            style={textareaStyle}
            placeholder="O que este serviço é responsável por fazer"
          />
        </Field>
        <Field label="Tipo de Serviço">
          <select
            value={data.service.type}
            onChange={(e) => set("service.type", e.target.value)}
            style={selectStyle}
          >
            <option value="">Selecione...</option>
            {serviceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Repositório">
          <input
            value={data.service.repo}
            onChange={(e) => set("service.repo", e.target.value)}
            style={inputStyle}
            placeholder="ex: github.com/org/payment-service"
          />
        </Field>
      </div>
    );
  }

  function renderFeature() {
    const triggers = ["Request HTTP", "Evento de Fila", "Scheduler/Cron", "Chamada Interna"];
    return (
      <div>
        <h2 style={{ color: C.accent, fontSize: 16, marginBottom: 20, marginTop: 0 }}>Feature</h2>
        <Field label="Nome da Feature">
          <input
            value={data.feature.name}
            onChange={(e) => set("feature.name", e.target.value)}
            style={inputStyle}
            placeholder="ex: Processamento de Estorno"
          />
        </Field>
        <Field label="Problema que Resolve">
          <textarea
            value={data.feature.problem}
            onChange={(e) => set("feature.problem", e.target.value)}
            style={textareaStyle}
            placeholder="Qual problema de negócio esta feature resolve?"
          />
        </Field>
        <Field label="Features / Issues Relacionadas">
          <input
            value={data.feature.related}
            onChange={(e) => set("feature.related", e.target.value)}
            style={inputStyle}
            placeholder="ex: TICKET-123, TICKET-456"
          />
        </Field>
        <Field label="Trigger de Execução">
          <select
            value={data.feature.trigger}
            onChange={(e) => set("feature.trigger", e.target.value)}
            style={selectStyle}
          >
            <option value="">Selecione...</option>
            {triggers.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Volume Esperado">
          <input
            value={data.feature.volume}
            onChange={(e) => set("feature.volume", e.target.value)}
            style={inputStyle}
            placeholder="ex: 1000 req/min, 50k eventos/dia"
          />
        </Field>
      </div>
    );
  }

  function renderInterface() {
    const ifTypes = ["HTTP Endpoint", "Consumer de Evento", "Task Agendada", "Função Interna"];
    const methods  = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    const isHttp   = data.interface.type === "HTTP Endpoint";
    return (
      <div>
        <h2 style={{ color: C.accent, fontSize: 16, marginBottom: 20, marginTop: 0 }}>Interface</h2>
        <Field label="Tipo de Interface">
          <select
            value={data.interface.type}
            onChange={(e) => set("interface.type", e.target.value)}
            style={selectStyle}
          >
            <option value="">Selecione...</option>
            {ifTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        {isHttp && (
          <>
            <Field label="Método HTTP">
              <select
                value={data.interface.method}
                onChange={(e) => set("interface.method", e.target.value)}
                style={selectStyle}
              >
                <option value="">Selecione...</option>
                {methods.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Path">
              <input
                value={data.interface.path}
                onChange={(e) => set("interface.path", e.target.value)}
                style={inputStyle}
                placeholder="ex: /api/v1/payments/{id}/refund"
              />
            </Field>
          </>
        )}
        <Field label="Campos da Requisição / Input">
          <textarea
            value={data.interface.requestFields}
            onChange={(e) => set("interface.requestFields", e.target.value)}
            style={textareaStyle}
            placeholder="Liste os campos com tipo e obrigatoriedade"
          />
        </Field>
        <Field label="Schema de Resposta / Output">
          <textarea
            value={data.interface.responseSchema}
            onChange={(e) => set("interface.responseSchema", e.target.value)}
            style={textareaStyle}
            placeholder="Estrutura da resposta esperada"
          />
        </Field>
        <Field label="Códigos de Erro">
          <input
            value={data.interface.errorCodes}
            onChange={(e) => set("interface.errorCodes", e.target.value)}
            style={inputStyle}
            placeholder="ex: 400 Bad Request, 404 Not Found, 422 Unprocessable"
          />
        </Field>
      </div>
    );
  }

  function renderRules() {
    function updateRule(i, field, value) {
      const updated = data.rules.map((r, idx) =>
        idx === i ? { ...r, [field]: value } : r
      );
      set("rules", updated);
    }
    return (
      <div>
        <h2 style={{ color: C.accent, fontSize: 16, marginBottom: 20, marginTop: 0 }}>Regras de Negócio</h2>
        {data.rules.map((rule, i) => (
          <div
            key={i}
            style={{
              background: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ color: C.textMuted, fontSize: 11, fontFamily: FONT }}>REGRA {i + 1}</span>
              {data.rules.length > 1 && (
                <button
                  onClick={() => set("rules", data.rules.filter((_, idx) => idx !== i))}
                  style={{
                    background: "none", border: "none", color: C.error,
                    cursor: "pointer", fontFamily: FONT, fontSize: 12,
                  }}
                >
                  Remover
                </button>
              )}
            </div>
            <Field label="Nome da Regra">
              <input
                value={rule.name}
                onChange={(e) => updateRule(i, "name", e.target.value)}
                style={inputStyle}
                placeholder="ex: Limite Diário de Transações"
              />
            </Field>
            <Field label="Condição">
              <textarea
                value={rule.condition}
                onChange={(e) => updateRule(i, "condition", e.target.value)}
                style={{ ...textareaStyle, minHeight: 60 }}
                placeholder="Quando isso acontece..."
              />
            </Field>
            <Field label="Comportamento Esperado">
              <textarea
                value={rule.behavior}
                onChange={(e) => updateRule(i, "behavior", e.target.value)}
                style={{ ...textareaStyle, minHeight: 60 }}
                placeholder="O sistema deve..."
              />
            </Field>
          </div>
        ))}
        <button
          onClick={() => set("rules", [...data.rules, { name: "", condition: "", behavior: "" }])}
          style={{
            background: "none",
            border: `1px dashed ${C.border}`,
            color: C.textMuted,
            borderRadius: 8,
            padding: "10px 0",
            width: "100%",
            cursor: "pointer",
            fontFamily: FONT,
            fontSize: 13,
          }}
        >
          + Adicionar Regra
        </button>
      </div>
    );
  }

  function renderData() {
    return (
      <div>
        <h2 style={{ color: C.accent, fontSize: 16, marginBottom: 20, marginTop: 0 }}>Camada de Dados</h2>
        <Field label="Tabelas / Coleções de Leitura">
          <input
            value={data.data.readTables}
            onChange={(e) => set("data.readTables", e.target.value)}
            style={inputStyle}
            placeholder="ex: payments, accounts, customers"
          />
        </Field>
        <Field label="Tabelas / Coleções de Escrita">
          <input
            value={data.data.writeTables}
            onChange={(e) => set("data.writeTables", e.target.value)}
            style={inputStyle}
            placeholder="ex: refunds, audit_logs"
          />
        </Field>
        <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            cursor: "pointer", fontFamily: FONT, fontSize: 13, color: C.textSec,
          }}>
            <input
              type="checkbox"
              checked={data.data.transactional}
              onChange={(e) => set("data.transactional", e.target.checked)}
              style={{ accentColor: C.accent, width: 16, height: 16 }}
            />
            Operações Transacionais
          </label>
          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            cursor: "pointer", fontFamily: FONT, fontSize: 13, color: C.textSec,
          }}>
            <input
              type="checkbox"
              checked={data.data.migrations}
              onChange={(e) => set("data.migrations", e.target.checked)}
              style={{ accentColor: C.accent, width: 16, height: 16 }}
            />
            Requer Migrations
          </label>
        </div>
      </div>
    );
  }

  function renderTests() {
    function updateTest(i, field, value) {
      const updated = data.tests.map((t, idx) =>
        idx === i ? { ...t, [field]: value } : t
      );
      set("tests", updated);
    }
    return (
      <div>
        <h2 style={{ color: C.accent, fontSize: 16, marginBottom: 20, marginTop: 0 }}>Cenários de Teste</h2>
        {data.tests.map((test, i) => (
          <div
            key={i}
            style={{
              background: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ color: C.textMuted, fontSize: 11, fontFamily: FONT }}>CENÁRIO {i + 1}</span>
              {data.tests.length > 1 && (
                <button
                  onClick={() => set("tests", data.tests.filter((_, idx) => idx !== i))}
                  style={{
                    background: "none", border: "none", color: C.error,
                    cursor: "pointer", fontFamily: FONT, fontSize: 12,
                  }}
                >
                  Remover
                </button>
              )}
            </div>
            <Field label="Nome do Cenário">
              <input
                value={test.scenario}
                onChange={(e) => updateTest(i, "scenario", e.target.value)}
                style={inputStyle}
                placeholder="ex: Estorno com saldo insuficiente"
              />
            </Field>
            <Field label="Given (Dado que)">
              <textarea
                value={test.given}
                onChange={(e) => updateTest(i, "given", e.target.value)}
                style={{ ...textareaStyle, minHeight: 60 }}
                placeholder="Estado inicial do sistema"
              />
            </Field>
            <Field label="When (Quando)">
              <textarea
                value={test.when}
                onChange={(e) => updateTest(i, "when", e.target.value)}
                style={{ ...textareaStyle, minHeight: 60 }}
                placeholder="Ação executada"
              />
            </Field>
            <Field label="Then (Então)">
              <textarea
                value={test.then}
                onChange={(e) => updateTest(i, "then", e.target.value)}
                style={{ ...textareaStyle, minHeight: 60 }}
                placeholder="Resultado esperado"
              />
            </Field>
          </div>
        ))}
        <button
          onClick={() => set("tests", [...data.tests, { scenario: "", given: "", when: "", then: "" }])}
          style={{
            background: "none",
            border: `1px dashed ${C.border}`,
            color: C.textMuted,
            borderRadius: 8,
            padding: "10px 0",
            width: "100%",
            cursor: "pointer",
            fontFamily: FONT,
            fontSize: 13,
          }}
        >
          + Adicionar Cenário
        </button>
      </div>
    );
  }

  function renderEvalResult() {
    const r = evalResult;
    const dims = [
      { key: "contexto",       label: "Contexto" },
      { key: "interface",      label: "Interface" },
      { key: "regras_negocio", label: "Regras de Negócio" },
      { key: "dados",          label: "Dados" },
      { key: "testes",         label: "Testes" },
      { key: "tecnico",        label: "Técnico" },
    ];
    return (
      <div>
        {/* Score geral */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          background: C.surfaceAlt, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: "16px 20px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: scoreColor(r.score_geral), fontFamily: FONT }}>
            {r.score_geral}/10
          </div>
          <div>
            <div style={{ color: C.textSec, fontSize: 12, fontFamily: FONT }}>Score Geral</div>
            <div style={{
              display: "inline-block",
              marginTop: 4,
              padding: "2px 8px",
              borderRadius: 4,
              background: r.pronta_para_agente ? `${C.accentStr}22` : `${C.error}22`,
              border: `1px solid ${r.pronta_para_agente ? C.accentStr : C.error}`,
              color: r.pronta_para_agente ? C.accentStr : C.error,
              fontSize: 11, fontFamily: FONT,
            }}>
              {r.pronta_para_agente ? "✓ Pronta para agente" : "✗ Revisão necessária"}
            </div>
          </div>
        </div>

        {/* Dimensões */}
        <div style={{ marginBottom: 16 }}>
          {dims.map((d) => {
            const dim = r.dimensoes?.[d.key];
            if (!dim) return null;
            return (
              <div key={d.key} style={{
                background: C.surfaceAlt, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: 12, marginBottom: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ color: C.textSec, fontSize: 12, fontFamily: FONT }}>{d.label}</span>
                  <span style={{ color: scoreColor(dim.score), fontSize: 13, fontFamily: FONT, fontWeight: 600 }}>
                    {dim.score}/10
                  </span>
                </div>
                {dim.lacunas?.length > 0 && (
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    {dim.lacunas.map((l, i) => (
                      <li key={i} style={{ color: C.textMuted, fontSize: 11, fontFamily: FONT, marginBottom: 2 }}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {r.ambiguidades?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: C.warning, fontSize: 12, fontFamily: FONT, marginBottom: 6 }}>Ambiguidades</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {r.ambiguidades.map((a, i) => (
                <li key={i} style={{ color: C.textMuted, fontSize: 12, fontFamily: FONT, marginBottom: 4 }}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {r.perguntas_pendentes?.length > 0 && (
          <div>
            <div style={{ color: C.warning, fontSize: 12, fontFamily: FONT, marginBottom: 6 }}>Perguntas Pendentes</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {r.perguntas_pendentes.map((p, i) => (
                <li key={i} style={{ color: C.textMuted, fontSize: 12, fontFamily: FONT, marginBottom: 4 }}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function renderSpecMd() {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? C.accentStr : C.borderAct,
              border: `1px solid ${C.accentStr}`,
              color: copied ? C.bg : C.accent,
              borderRadius: 6,
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: FONT,
              fontSize: 12,
            }}
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <pre style={{
          background: C.surfaceAlt,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 16,
          color: C.textSec,
          fontFamily: FONT,
          fontSize: 12,
          lineHeight: 1.6,
          overflowY: "auto",
          maxHeight: 500,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          margin: 0,
        }}>
          {specMd}
        </pre>
      </div>
    );
  }

  function renderEvaluate() {
    const btnDisabled = {
      background: C.surfaceAlt,
      border: `1px solid ${C.border}`,
      color: C.textMuted,
      opacity: 0.6,
      cursor: "wait",
    };
    return (
      <div>
        <h2 style={{ color: C.accent, fontSize: 16, marginBottom: 8, marginTop: 0 }}>Avaliar & Gerar</h2>

        <Field label="Fora do Escopo">
          <textarea
            value={data.outOfScope}
            onChange={(e) => set("outOfScope", e.target.value)}
            style={textareaStyle}
            placeholder="O que este serviço/feature NÃO deve fazer"
          />
        </Field>
        <Field label="Dicas para o Agente">
          <textarea
            value={data.agentHints}
            onChange={(e) => set("agentHints", e.target.value)}
            style={textareaStyle}
            placeholder="Padrões preferidos, libs obrigatórias, pitfalls, etc."
          />
        </Field>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <button
            onClick={handleEvaluate}
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 8,
              fontFamily: FONT,
              fontSize: 13,
              ...(loading ? btnDisabled : {
                background: C.borderAct,
                border: `1px solid ${C.accentStr}`,
                color: C.accent,
                cursor: "pointer",
              }),
            }}
          >
            {loading && activeTab === "evaluate" ? "Avaliando..." : "Avaliar Spec"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 8,
              fontFamily: FONT,
              fontSize: 13,
              ...(loading ? btnDisabled : {
                background: C.surface,
                border: `1px solid ${C.borderAct}`,
                color: C.textSec,
                cursor: "pointer",
              }),
            }}
          >
            {loading && activeTab === "spec" ? "Gerando..." : "Gerar .md"}
          </button>
        </div>

        {error && (
          <div style={{
            background: `${C.error}18`,
            border: `1px solid ${C.error}`,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            color: C.error,
            fontSize: 13,
            fontFamily: FONT,
          }}>
            {error}
          </div>
        )}

        {(evalResult || specMd) && (
          <div>
            <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 0 }}>
              {evalResult && (
                <button
                  onClick={() => setActiveTab("evaluate")}
                  style={{
                    padding: "8px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: `2px solid ${activeTab === "evaluate" ? C.accentStr : "transparent"}`,
                    color: activeTab === "evaluate" ? C.accent : C.textMuted,
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: 12,
                    marginBottom: -1,
                  }}
                >
                  Avaliação
                </button>
              )}
              {specMd && (
                <button
                  onClick={() => setActiveTab("spec")}
                  style={{
                    padding: "8px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: `2px solid ${activeTab === "spec" ? C.accentStr : "transparent"}`,
                    color: activeTab === "spec" ? C.accent : C.textMuted,
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: 12,
                    marginBottom: -1,
                  }}
                >
                  Spec .md
                </button>
              )}
            </div>
            <div style={{ paddingTop: 16 }}>
              {activeTab === "evaluate" && evalResult && renderEvalResult()}
              {activeTab === "spec"     && specMd     && renderSpecMd()}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- Mapa de renderers ----
  const stepRenderers = {
    type:      renderType,
    system:    renderSystem,
    service:   renderService,
    feature:   renderFeature,
    interface: renderInterface,
    rules:     renderRules,
    data:      renderData,
    tests:     renderTests,
    evaluate:  renderEvaluate,
  };

  // ---- Render principal ----
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: FONT, color: C.textPrimary, boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <span style={{ color: C.accent, fontSize: 13, fontWeight: 600 }}>spec-generator</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Status pill */}
          <div style={{
            background: "#1a3a2a",
            border: `1px solid ${C.borderAct}`,
            borderRadius: 4,
            padding: "2px 8px",
            color: C.accent,
            fontSize: 11,
            fontFamily: FONT,
          }}>
            {llmConfig.provider} · {truncModel}
          </div>
          {/* Settings icon */}
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: "none",
              border: `1px solid ${C.border}`,
              color: C.textMuted,
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontFamily: FONT,
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px 80px" }}>
        <div ref={topRef} />

        {/* Barra de progresso — oculta no step "type" */}
        {currentStep !== "type" && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {progressSteps.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: i <= progressIdx ? C.accentStr : C.border,
                    transition: "background 0.2s",
                  }}
                />
              ))}
            </div>
            <div style={{ color: C.textMuted, fontSize: 11 }}>
              {progressIdx + 1} / {progressSteps.length} — {STEPS.find((s) => s.id === currentStep)?.label}
            </div>
          </div>
        )}

        {/* Step atual */}
        {stepRenderers[currentStep]?.()}

        {/* Navegação — oculta no step "type" */}
        {currentStep !== "type" && (
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 32,
            paddingTop: 20,
            borderTop: `1px solid ${C.border}`,
          }}>
            <button
              onClick={handleBack}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: FONT,
                fontSize: 13,
                background: "none",
                border: `1px solid ${C.border}`,
                color: C.textMuted,
              }}
            >
              ← Voltar
            </button>
            {currentStep !== "evaluate" && (
              <button
                onClick={handleNext}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: FONT,
                  fontSize: 13,
                  background: C.borderAct,
                  border: `1px solid ${C.accentStr}`,
                  color: C.accent,
                }}
              >
                Próximo →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Overlay de settings */}
      {showSettings && <SettingsPanel />}
    </div>
  );
}
