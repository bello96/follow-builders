import { buildMessages, type Feeds, type Prompts } from '../../src/digest-core';
import { callDeepSeek } from '../../src/deepseek';

interface Env { DEEPSEEK_API_KEY: string; }

const BASE = 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main';
const PROMPT_FILES: Record<keyof Prompts, string> = {
  digest_intro: 'digest-intro.md',
  summarize_tweets: 'summarize-tweets.md',
  summarize_podcast: 'summarize-podcast.md',
  summarize_blogs: 'summarize-blogs.md',
  translate: 'translate.md',
};

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) { throw new Error(`拉取失败 ${r.status}: ${url}`); }
  return r.json() as Promise<T>;
}
async function fetchText(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) { throw new Error(`拉取失败 ${r.status}: ${url}`); }
  return r.text();
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  try {
    const apiKey = context.env.DEEPSEEK_API_KEY;
    if (!apiKey) { return json({ error: '服务器未配置 DEEPSEEK_API_KEY' }, 500); }

    const [fx, fp, fb] = await Promise.all([
      fetchJSON<{ x: Feeds['x'] }>(`${BASE}/feed-x.json`),
      fetchJSON<{ podcasts: Feeds['podcasts'] }>(`${BASE}/feed-podcasts.json`),
      fetchJSON<{ blogs: Feeds['blogs'] }>(`${BASE}/feed-blogs.json`),
    ]);
    const entries = await Promise.all(
      (Object.entries(PROMPT_FILES) as [keyof Prompts, string][]).map(
        async ([k, f]) => [k, await fetchText(`${BASE}/prompts/${f}`)] as const,
      ),
    );
    const prompts = Object.fromEntries(entries) as unknown as Prompts;
    const feeds: Feeds = { x: fx.x ?? [], podcasts: fp.podcasts ?? [], blogs: fb.blogs ?? [] };

    const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    const messages = buildMessages(feeds, prompts, dateStr);
    const { content } = await callDeepSeek(messages, apiKey);
    return json({ digest: content, generatedAt: new Date().toISOString() });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
};
