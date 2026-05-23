import { describe, it, expect } from 'vitest';
import { formatFeedContent, buildMessages, type Feeds, type Prompts } from './digest-core';

const feeds: Feeds = {
  x: [{ name: 'Aaron Levie', handle: 'levie', bio: 'ceo @box', tweets: [{ text: 'AI costs are stratifying', url: 'https://x.com/levie/status/1' }] }],
  blogs: [{ source: 'blog', title: 'Auto mode', url: 'https://anthropic.com/x', content: 'Body text' }],
  podcasts: [{ name: 'MAD Podcast', title: 'Yann Dubois', url: 'https://youtube.com/watch?v=1', transcript: 'transcript text' }],
};
const prompts: Prompts = {
  digest_intro: 'INTRO', summarize_tweets: 'TWEET', summarize_podcast: 'POD', summarize_blogs: 'BLOG', translate: 'TRANS',
};

describe('formatFeedContent', () => {
  it('includes tweet text + url', () => {
    const out = formatFeedContent(feeds);
    expect(out).toContain('Aaron Levie');
    expect(out).toContain('AI costs are stratifying');
    expect(out).toContain('https://x.com/levie/status/1');
  });
  it('includes blog and podcast sections', () => {
    const out = formatFeedContent(feeds);
    expect(out).toContain('Auto mode');
    expect(out).toContain('transcript text');
  });
});

describe('buildMessages', () => {
  it('puts all prompt rules in system message and feed in user message', () => {
    const msgs = buildMessages(feeds, prompts, '2026 年 5 月 23 日');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('INTRO');
    expect(msgs[0].content).toContain('TRANS');
    expect(msgs[0].content).toContain('2026 年 5 月 23 日');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toContain('Aaron Levie');
  });
});
