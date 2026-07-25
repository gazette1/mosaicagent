/**
 * OpenAI client. Zero-dependency (Node 18+ fetch).
 *
 * Tokenomics discipline baked in:
 * - Model routing by price tier (config/models.json)
 * - JSON-schema-constrained output (cap the output; code consumes it)
 * - Retry budget: 2 attempts, then throw to a human
 * - Usage + estimated cost returned on every call and audit-logged upstream
 */

import * as fs from 'fs';
import * as path from 'path';

interface ModelsConfig {
  provider: string;
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

export function llmAvailable(): boolean {
  loadEnv();
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface LlmUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
  attempts: number;
}

export interface LlmJsonResult<T = unknown> {
  data: T;
  usage: LlmUsage;
}

/** Content parts for multimodal calls (text, files for server-side OCR, images) */
export type UserContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'file'; file: { filename: string; file_data: string } }
      | { type: 'image_url'; image_url: { url: string } }
    >;

/**
 * Call a routed model with a JSON-schema-constrained response.
 * role: which routing tier to use ('extraction' | 'judge' | 'narrative' | 'escalation')
 * user may be plain text or multimodal parts (PDF files are OCRed server-side).
 */
export async function callJson<T = unknown>(
  role: string,
  system: string,
  user: UserContent,
  schemaName: string,
  schema: Record<string, unknown>,
  maxOutputTokens = 2000
): Promise<LlmJsonResult<T>> {
  loadEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const cfg = getModelsConfig();
  const model = cfg.routing[role];
  if (!model) throw new Error(`No model routed for role: ${role}`);

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_completion_tokens: maxOutputTokens,
    response_format: {
      type: 'json_schema',
      json_schema: { name: schemaName, strict: true, schema },
    },
  };

  // Retry budget: two attempts, then hand it to a human
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        error?: { message: string };
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      if (json.error) throw new Error(json.error.message);
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error('empty completion');
      const data = JSON.parse(content) as T;

      const inTok = json.usage?.prompt_tokens ?? 0;
      const outTok = json.usage?.completion_tokens ?? 0;
      const price = cfg.estPricePer1M[model] ?? { input: 0, output: 0 };
      return {
        data,
        usage: {
          model,
          inputTokens: inTok,
          outputTokens: outTok,
          estCostUsd: (inTok * price.input + outTok * price.output) / 1_000_000,
          attempts: attempt,
        },
      };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(`LLM call failed after retry budget (2): ${lastErr?.message}`);
}
