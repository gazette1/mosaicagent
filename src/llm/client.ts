/**
 * Multi-provider LLM client (OpenAI + Moonshot/Kimi). Zero-dependency.
 *
 * Routing entries in config/models.json are "provider:model" (bare model
 * names default to openai). Both providers speak the OpenAI chat API; when a
 * provider rejects strict json_schema response_format, the call falls back to
 * json_object with the schema embedded in the system prompt, and the result
 * is still parsed and shape-checked locally.
 *
 * Tokenomics discipline:
 * - Model routing by price tier and fit
 * - JSON-constrained output (code consumes it)
 * - Retry budget: 2 attempts, then throw to a human
 * - Usage + estimated cost returned on every call and audit-logged upstream
 */

import * as fs from 'fs';
import * as path from 'path';

interface ProviderCfg { baseUrl: string; keyEnv: string }
interface ModelsConfig {
  providers: Record<string, ProviderCfg>;
  routing: Record<string, string>;
  estPricePer1M: Record<string, { input: number; output: number }>;
}

let envLoaded = false;
function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  for (const dir of [process.cwd(), path.join(__dirname, '..', '..')]) {
    const p = path.join(dir, '.env');
    if (fs.existsSync(p)) {
      for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
      }
      return;
    }
  }
}

let modelsCfg: ModelsConfig | null = null;
export function getModelsConfig(): ModelsConfig {
  if (modelsCfg) return modelsCfg;
  for (const dir of [process.cwd(), path.join(__dirname, '..', '..')]) {
    const p = path.join(dir, 'config', 'models.json');
    if (fs.existsSync(p)) {
      modelsCfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return modelsCfg!;
    }
  }
  throw new Error('config/models.json not found');
}

function resolveRoute(role: string): { provider: string; model: string; cfg: ProviderCfg } {
  const c = getModelsConfig();
  const entry = c.routing[role];
  if (!entry) throw new Error(`No model routed for role: ${role}`);
  const [maybeProvider, maybeModel] = entry.includes(':') ? entry.split(':', 2) : ['openai', entry];
  const cfg = c.providers[maybeProvider];
  if (!cfg) throw new Error(`Unknown provider "${maybeProvider}" for role ${role}`);
  return { provider: maybeProvider, model: maybeModel, cfg };
}

export function llmAvailable(): boolean {
  loadEnv();
  // Extraction is the load-bearing tier; its provider's key decides availability
  try {
    const { cfg } = resolveRoute('extraction');
    return Boolean(process.env[cfg.keyEnv]);
  } catch {
    return Boolean(process.env.OPENAI_API_KEY);
  }
}

export interface LlmUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
  attempts: number;
}

export interface LlmJsonResult<T = unknown> { data: T; usage: LlmUsage }

/** Content parts for multimodal calls (text, files for server-side OCR, images) */
export type UserContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'file'; file: { filename: string; file_data: string } }
      | { type: 'image_url'; image_url: { url: string } }
    >;

// Providers that have rejected strict json_schema this process: fall back to
// json_object + schema-in-prompt for the rest of the session.
// Moonshot (Kimi) starts there: probing showed strict json_schema yields
// empty content while json_object works reliably.
const schemaUnsupported = new Set<string>(['moonshot']);

export async function callJson<T = unknown>(
  role: string,
  system: string,
  user: UserContent,
  schemaName: string,
  schema: Record<string, unknown>,
  maxOutputTokens = 2000
): Promise<LlmJsonResult<T>> {
  loadEnv();
  const { provider, model, cfg } = resolveRoute(role);
  const apiKey = process.env[cfg.keyEnv];
  if (!apiKey) throw new Error(`${cfg.keyEnv} not set (.env)`);

  const c = getModelsConfig();
  const price = c.estPricePer1M[model] ?? { input: 0, output: 0 };

  const attempt = async (useStrictSchema: boolean) => {
    const sys = useStrictSchema
      ? system
      : `${system}\n\nRespond with a single JSON object matching this JSON Schema exactly (no extra keys, no prose):\n${JSON.stringify(schema)}`;
    // Kimi K3 is a reasoning model: hidden reasoning tokens count against the
    // completion budget, so give it headroom. Param name also differs.
    const isMoonshot = provider === 'moonshot';
    const tokenBudget = isMoonshot ? Math.max(maxOutputTokens * 2, maxOutputTokens + 1500) : maxOutputTokens;
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      response_format: useStrictSchema
        ? { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } }
        : { type: 'json_object' },
    };
    body[isMoonshot ? 'max_tokens' : 'max_completion_tokens'] = tokenBudget;
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      error?: { message?: string; type?: string };
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (json.error) {
      const msg = json.error.message ?? JSON.stringify(json.error);
      if (useStrictSchema && /response_format|json_schema|schema/i.test(msg)) {
        schemaUnsupported.add(provider);
        throw Object.assign(new Error(msg), { schemaReject: true });
      }
      throw new Error(msg);
    }
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('empty completion');
    return { data: JSON.parse(content) as T, usage: json.usage };
  };

  let lastErr: Error | null = null;
  let attempts = 0;
  for (let i = 1; i <= 2; i++) {
    attempts = i;
    try {
      const useStrict = !schemaUnsupported.has(provider);
      let out;
      try {
        out = await attempt(useStrict);
      } catch (e) {
        // Immediate same-attempt fallback when the provider rejects the schema format
        if ((e as { schemaReject?: boolean }).schemaReject) out = await attempt(false);
        else throw e;
      }
      const inTok = out.usage?.prompt_tokens ?? 0;
      const outTok = out.usage?.completion_tokens ?? 0;
      return {
        data: out.data,
        usage: {
          model: `${provider}:${model}`,
          inputTokens: inTok,
          outputTokens: outTok,
          estCostUsd: (inTok * price.input + outTok * price.output) / 1_000_000,
          attempts,
        },
      };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(`LLM call failed after retry budget (2) on ${provider}:${model}: ${lastErr?.message}`);
}
