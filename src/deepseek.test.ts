import { describe, it, expect, vi } from 'vitest';
import { callDeepSeek } from './deepseek';

describe('callDeepSeek', () => {
  it('sends correct request and parses content', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '中文摘要' } }] }), { status: 200 }),
    );
    const result = await callDeepSeek([{ role: 'user', content: 'hi' }], 'KEY123', mockFetch as unknown as typeof fetch);
    expect(result.content).toBe('中文摘要');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect((opts as RequestInit).headers).toMatchObject({ Authorization: 'Bearer KEY123' });
  });
  it('throws on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('bad', { status: 500 }));
    await expect(callDeepSeek([{ role: 'user', content: 'hi' }], 'K', mockFetch as unknown as typeof fetch)).rejects.toThrow('DeepSeek');
  });
});
