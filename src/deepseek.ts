import type { ChatMessage } from './digest-core';

export interface DeepSeekResult { content: string; }

export async function callDeepSeek(
  messages: ChatMessage[],
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<DeepSeekResult> {
  const res = await fetchFn('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.6, max_tokens: 8000, stream: false }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${errText}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) { throw new Error('DeepSeek 返回空内容'); }
  return { content };
}
