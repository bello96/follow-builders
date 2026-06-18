export interface Tweet { text?: string; url?: string; }
export interface Builder { name?: string; handle?: string; bio?: string; tweets?: Tweet[]; }
export interface Podcast { name?: string; title?: string; url?: string; transcript?: string; }
export interface Blog { source?: string; name?: string; title?: string; url?: string; author?: string; description?: string; content?: string; }
export interface Feeds { x: Builder[]; podcasts: Podcast[]; blogs: Blog[]; }
export interface Prompts { digest_intro: string; summarize_tweets: string; summarize_podcast: string; summarize_blogs: string; translate: string; }
export interface ChatMessage { role: 'system' | 'user'; content: string; }
export interface SourceSelection { x: string[]; podcasts: string[]; blogs: string[]; }

export function filterFeeds(feeds: Feeds, selection: SourceSelection): Feeds {
  return {
    x: (feeds.x ?? []).filter((b) => !!b.handle && selection.x.includes(b.handle)),
    podcasts: (feeds.podcasts ?? []).filter((p) => !!p.name && selection.podcasts.includes(p.name)),
    blogs: (feeds.blogs ?? []).filter((b) => !!b.name && selection.blogs.includes(b.name)),
  };
}

export function formatFeedContent(feeds: Feeds): string {
  const parts: string[] = ['===TWEETS==='];
  for (const b of feeds.x ?? []) {
    parts.push(`\n## ${b.name ?? ''} (@${b.handle ?? ''})`);
    if (b.bio) { parts.push(`BIO: ${b.bio}`); }
    for (const t of b.tweets ?? []) {
      parts.push(`- ${(t.text ?? '').replace(/\s+/g, ' ').trim()}`);
      parts.push(`  URL: ${t.url ?? ''}`);
    }
  }
  parts.push('\n\n===BLOGS===');
  for (const b of feeds.blogs ?? []) {
    parts.push(`\n## ${b.source ?? b.name ?? ''}: ${b.title ?? ''}`);
    parts.push(`URL: ${b.url ?? ''}`);
    parts.push(`BODY:\n${b.content ?? b.description ?? ''}`);
  }
  parts.push('\n\n===PODCAST===');
  for (const p of feeds.podcasts ?? []) {
    parts.push(`\n## ${p.name ?? ''}: ${p.title ?? ''}`);
    parts.push(`URL: ${p.url ?? ''}`);
    parts.push(`TRANSCRIPT:\n${p.transcript ?? ''}`);
  }
  return parts.join('\n');
}

export function buildMessages(feeds: Feeds, prompts: Prompts, dateStr: string): ChatMessage[] {
  const system = [
    '你是 AI 行业资讯的中文编辑。严格依据提供的原始内容做混编摘要，不得编造，每条必须保留原始链接。',
    '输出整份简体中文 digest。遵循以下规则：',
    '\n## 整体格式\n' + prompts.digest_intro,
    '\n## 推文摘要\n' + prompts.summarize_tweets,
    '\n## 博客摘要\n' + prompts.summarize_blogs,
    '\n## 播客混编\n' + prompts.summarize_podcast,
    '\n## 中文风格\n' + prompts.translate,
    `\n标题用："AI Builders Digest · ${dateStr}"。顺序：X / Twitter、官方博客、播客。结尾加一行："通过 Follow Builders 生成"。不要使用破折号。`,
  ].join('\n');
  const user = '以下是今天的原始 feed 内容，请据此生成中文 digest：\n\n' + formatFeedContent(feeds);
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
