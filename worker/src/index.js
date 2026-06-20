const ALLOWED_ORIGIN = '*';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const { messages, system } = body;

    // Convert Anthropic-style messages to Gemini format
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const geminiBody = {
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    };

    const geminiRes = await fetch(`${GEMINI_URL}?key=${(env.GEMINI_API_KEY || '').trim()}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    const data = await geminiRes.json();

    // Normalize to Anthropic-like response so the dashboard code doesn't change
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.error?.message || '(ไม่ได้รับคำตอบ)';
    const normalized = { content: [{ type: 'text', text }] };

    return new Response(JSON.stringify(normalized), {
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Content-Type': 'application/json',
      },
    });
  },
};
