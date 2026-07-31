import { NextResponse } from 'next/server';
import { getApiKey } from '@/lib/api-keys';

export const dynamic = 'force-dynamic';

async function tryProvider(name: string, apiKey: string, baseURL: string | undefined, model: string) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey, baseURL });
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
    max_tokens: 5,
    temperature: 0,
  });
  return res.choices[0]?.message?.content || '';
}

export async function GET() {
  const steps: Record<string, string> = {};

  // 1. Check env vars
  steps.env_openai = process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    ? 'SET (AI_INTEGRATIONS)'
    : process.env.OPENAI_API_KEY
    ? 'SET (OPENAI_API_KEY)'
    : 'NOT SET';
  steps.env_groq = process.env.GROQ_API_KEY ? 'SET' : 'NOT SET';

  // 2. Check admin panel keys
  let adminOpenAI = '', adminGroq = '';
  try {
    adminOpenAI = await getApiKey('openai_api_key');
    steps.admin_openai = adminOpenAI ? `SET (${adminOpenAI.slice(0, 8)}...)` : 'NOT SET';
  } catch (e) {
    steps.admin_openai = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }
  try {
    adminGroq = await getApiKey('groq_api_key');
    steps.admin_groq = adminGroq ? `SET (${adminGroq.slice(0, 8)}...)` : 'NOT SET';
  } catch (e) {
    steps.admin_groq = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 3. Resolve providers
  const openaiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    adminOpenAI;
  const openaiBase =
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    undefined;
  const groqKey = process.env.GROQ_API_KEY || adminGroq;

  const results: Record<string, string> = {};

  // 4. Test OpenAI
  if (openaiKey) {
    try {
      const reply = await tryProvider('OpenAI', openaiKey, openaiBase, 'gpt-4o-mini');
      results.openai = `SUCCESS: "${reply}"`;
    } catch (e) {
      results.openai = `FAILED: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    results.openai = 'SKIPPED — no key';
  }

  // 5. Test Groq
  if (groqKey) {
    try {
      const reply = await tryProvider('Groq', groqKey, 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile');
      results.groq = `SUCCESS: "${reply}"`;
    } catch (e) {
      results.groq = `FAILED: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    results.groq = 'SKIPPED — no key (add it at /admin/settings → API Keys → Groq API key)';
  }

  const anyOk = Object.values(results).some(v => v.startsWith('SUCCESS'));
  return NextResponse.json({ ok: anyOk, steps, results });
}
