import { describe, it, expect } from 'vitest';
import { formatFeedContent, buildMessages, filterFeeds, type Feeds, type Prompts } from './digest-core';

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

describe('filterFeeds', () => {
  const full: Feeds = {
    x: [
      { name: 'Aaron Levie', handle: 'levie', tweets: [{ text: 'a' }] },
      { name: 'Andrej Karpathy', handle: 'karpathy', tweets: [{ text: 'b' }] },
      { name: 'No Handle', tweets: [{ text: 'c' }] },
    ],
    podcasts: [
      { name: 'Training Data', title: 't1' },
      { name: 'MAD Podcast', title: 't2' },
      { title: 'no name' },
    ],
    blogs: [
      { source: 'blog', name: 'Claude Blog', title: 'b1' },
      { source: 'blog', name: 'OpenAI Blog', title: 'b2' },
      { source: 'blog', title: 'no name blog' },
    ],
  };

  it('keeps only X builders whose handle is selected', () => {
    const out = filterFeeds(full, { x: ['levie'], podcasts: [], blogs: [] });
    expect(out.x.map((b) => b.handle)).toEqual(['levie']);
  });

  it('filters podcasts and blogs by name', () => {
    const out = filterFeeds(full, { x: [], podcasts: ['MAD Podcast'], blogs: ['Claude Blog'] });
    expect(out.podcasts.map((p) => p.name)).toEqual(['MAD Podcast']);
    expect(out.blogs.map((b) => b.name)).toEqual(['Claude Blog']);
  });

  it('returns an empty array for a group whose selection is empty', () => {
    const out = filterFeeds(full, { x: [], podcasts: [], blogs: [] });
    expect(out.x).toEqual([]);
    expect(out.podcasts).toEqual([]);
    expect(out.blogs).toEqual([]);
  });

  it('ignores selected handles/names that do not exist (no throw, no false include)', () => {
    const out = filterFeeds(full, { x: ['ghost'], podcasts: ['Nope'], blogs: ['Missing'] });
    expect(out.x).toEqual([]);
    expect(out.podcasts).toEqual([]);
    expect(out.blogs).toEqual([]);
  });

  it('skips entries missing handle/name', () => {
    const out = filterFeeds(full, {
      x: ['levie', 'karpathy'],
      podcasts: ['Training Data', 'MAD Podcast'],
      blogs: ['Claude Blog', 'OpenAI Blog'],
    });
    expect(out.x.map((b) => b.handle)).toEqual(['levie', 'karpathy']);
    expect(out.podcasts).toHaveLength(2);
    expect(out.blogs).toHaveLength(2);
  });

  it('does not mutate the input feeds', () => {
    filterFeeds(full, { x: ['levie'], podcasts: [], blogs: [] });
    expect(full.x).toHaveLength(3);
    expect(full.podcasts).toHaveLength(3);
    expect(full.blogs).toHaveLength(3);
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
