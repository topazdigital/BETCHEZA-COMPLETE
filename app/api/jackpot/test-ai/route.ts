import { NextResponse } from 'next/server';
import { getApiKey } from '@/lib/api-keys';

export const dynamic = 'force-dynamic';

export async function GET() {
  const steps: Record<string, string> = {};

  // 1. Check env vars
  steps.env_ai_integrations = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? 'SET' : 'NOT SET';
  steps.env_openai = process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET';
  steps.env_base_url = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'NOT SET';

  // 2. Check admin panel key
  let adminKey = '';
  try {
    adminKey = await getApiKey('openai_api_key');
    steps.admin_panel_key = adminKey ? `SET (${adminKey.slice(0, 8)}...)` : 'NOT SET / EMPTY';
  } catch (e) {
    steps.admin_panel_key = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 3. Resolve final credentials
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    adminKey;
  const baseURL =
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    undefined;

  steps.resolved_key = apiKey ? `${apiKey.slice(0, 8)}...` : 'NONE — will use fallback';
  steps.resolved_base_url = baseURL || 'default (api.openai.com)';

  if (!apiKey) {
    return NextResponse.json({ ok: false, steps, error: 'No OpenAI key found anywhere' });
  }

  // 4. Try a minimal OpenAI call
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey, baseURL });
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }],
      max_tokens: 5,
      temperature: 0,
    });
    const reply = res.choices[0]?.message?.content || '';
    steps.gpt_call = `SUCCESS: "${reply}"`;
    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    const errMsg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    steps.gpt_call = `FAILED: ${errMsg}`;
    return NextResponse.json({ ok: false, steps, error: errMsg });
  }
}
