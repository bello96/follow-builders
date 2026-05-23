# Follow Builders 网页版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一个网页，点「生成今日 AI 汇总」按钮，后端拉取 follow-builders 公开 feed 并调用 DeepSeek 生成中文 digest，显示在页面上。

**Architecture:** Cloudflare Pages（静态前端 `public/index.html`）+ Pages Functions（后端 `functions/api/digest.ts`）。纯逻辑（内容拼装、DeepSeek 调用）抽到 `src/` 便于单元测试。DeepSeek key 存 Cloudflare 环境变量。

**Tech Stack:** TypeScript、Cloudflare Pages/Functions、wrangler、vitest、DeepSeek API（OpenAI 兼容）。

---

## 提交约定（本机特例）

本机 Bash 命令含中文字符会报 `exit 127`。所有 commit 用中文 message，通过文件传入：

1. 用 Write 工具把 message 写到 `D:\code\demo\follow-builders-web\.commitmsg`
2. 运行（纯 ASCII 命令）：`git -C /d/code/demo/follow-builders-web add <files> && git -C /d/code/demo/follow-builders-web commit -F /d/code/demo/follow-builders-web/.commitmsg`
3. `rm -f /d/code/demo/follow-builders-web/.commitmsg`

Message 结尾用 `合作：Claude Code Opus`，**不要** `Co-Authored-By`。

---

## File Structure

```
follow-builders-web/
├── public/index.html              # 前端：按钮 + 结果区 + 复制 + loading + 错误
├── functions/api/digest.ts        # 后端 Pages Function：拉 feed/prompts → DeepSeek → JSON
├── src/digest-core.ts             # 纯逻辑：feed 提取文本、组装 DeepSeek messages
├── src/digest-core.test.ts        # 单元测试
├── src/deepseek.ts                # DeepSeek 调用封装（可注入 fetch 便于 mock）
├── src/deepseek.test.ts           # 单元测试
├── package.json
├── tsconfig.json
├── wrangler.toml
├── .gitignore
├── .dev.vars                      # 本地 DEEPSEEK_API_KEY（gitignore）
└── README.md
```

---

## Task 1: 项目脚手架

**Files:** Create `package.json`, `tsconfig.json`, `wrangler.toml`, `.gitignore`

- [ ] **Step 1: 写 `package.json`**

```json
{
  "name": "follow-builders-web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler pages dev public",
    "deploy": "wrangler pages deploy public",
    "test": "vitest run"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240909.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "wrangler": "^3.80.0"
  }
}
```

- [ ] **Step 2: 写 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["functions/**/*.ts", "src/**/*.ts"]
}
```

- [ ] **Step 3: 写 `wrangler.toml`**

```toml
name = "follow-builders-web"
compatibility_date = "2024-09-23"
pages_build_output_dir = "public"
```

- [ ] **Step 4: 写 `.gitignore`**

```
node_modules/
.dev.vars
.wrangler/
*.log
.commitmsg
```

- [ ] **Step 5: 安装依赖**

Run: `cd /d/code/demo/follow-builders-web && npm install`
Expected: 安装 wrangler、vitest、typescript 等，无报错。

- [ ] **Step 6: Commit**（用提交约定）

Message:
```
chore: 初始化网页项目脚手架

配置 package.json、tsconfig、wrangler.toml、.gitignore。

合作：Claude Code Opus
```
add: `package.json tsconfig.json wrangler.toml .gitignore`

---

## Task 2: 核心逻辑 `src/digest-core.ts`（TDD）

**Files:** Create `src/digest-core.ts`, `src/digest-core.test.ts`

- [ ] **Step 1: 写失败测试 `src/digest-core.test.ts`**

```typescript
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
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `cd /d/code/demo/follow-builders-web && npx vitest run src/digest-core.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/digest-core.ts`**

```typescript
export interface Tweet { text?: string; url?: string; }
export interface Builder { name?: string; handle?: string; bio?: string; tweets?: Tweet[]; }
export interface Podcast { name?: string; title?: string; url?: string; transcript?: string; }
export interface Blog { source?: string; name?: string; title?: string; url?: string; author?: string; description?: string; content?: string; }
export interface Feeds { x: Builder[]; podcasts: Podcast[]; blogs: Blog[]; }
export interface Prompts { digest_intro: string; summarize_tweets: string; summarize_podcast: string; summarize_blogs: string; translate: string; }
export interface ChatMessage { role: 'system' | 'user'; content: string; }

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
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `cd /d/code/demo/follow-builders-web && npx vitest run src/digest-core.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: Commit**（提交约定）

Message:
```
feat: 实现 feed 内容提取与 DeepSeek 消息组装

合作：Claude Code Opus
```
add: `src/digest-core.ts src/digest-core.test.ts`

---

## Task 3: DeepSeek 调用 `src/deepseek.ts`（TDD + mock）

**Files:** Create `src/deepseek.ts`, `src/deepseek.test.ts`

- [ ] **Step 1: 写失败测试 `src/deepseek.test.ts`**

```typescript
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
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `cd /d/code/demo/follow-builders-web && npx vitest run src/deepseek.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/deepseek.ts`**

```typescript
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
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `cd /d/code/demo/follow-builders-web && npx vitest run`
Expected: PASS（全部用例）。

- [ ] **Step 5: Commit**（提交约定）

Message:
```
feat: 封装 DeepSeek 调用

合作：Claude Code Opus
```
add: `src/deepseek.ts src/deepseek.test.ts`

---

## Task 4: 后端 `functions/api/digest.ts`

**Files:** Create `functions/api/digest.ts`

- [ ] **Step 1: 实现 Function**

```typescript
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
```

- [ ] **Step 2: 类型检查**

Run: `cd /d/code/demo/follow-builders-web && npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 3: Commit**（提交约定）

Message:
```
feat: 新增 /api/digest 后端接口

拉取公开 feed 与 prompts，调用 DeepSeek 生成中文 digest。

合作：Claude Code Opus
```
add: `functions/api/digest.ts`

---

## Task 5: 前端 `public/index.html`

**Files:** Create `public/index.html`

- [ ] **Step 1: 实现页面**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AI Builders Digest</title>
<style>
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 760px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #fafafa; }
  h1 { font-size: 22px; }
  #go { font-size: 16px; padding: 12px 24px; border: none; border-radius: 8px; background: #2563eb; color: #fff; cursor: pointer; }
  #go:disabled { background: #9ca3af; cursor: not-allowed; }
  #status { margin: 16px 0; color: #666; }
  #result { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-top: 16px; line-height: 1.7; display: none; }
  #result a { color: #2563eb; word-break: break-all; }
  #copy { display: none; margin-top: 12px; padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; }
  .err { color: #dc2626; }
</style>
</head>
<body>
  <h1>📡 AI Builders Digest</h1>
  <p>点下面的按钮，生成今天的中文 AI 摘要（X 动态 / 官方博客 / 播客）。</p>
  <button id="go">生成今日 AI 汇总</button>
  <div id="status"></div>
  <div id="result"></div>
  <button id="copy">复制全文</button>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script>
    const go = document.getElementById('go');
    const statusEl = document.getElementById('status');
    const result = document.getElementById('result');
    const copy = document.getElementById('copy');
    let raw = '';
    go.addEventListener('click', async () => {
      go.disabled = true; copy.style.display = 'none'; result.style.display = 'none';
      statusEl.className = ''; statusEl.textContent = '正在生成…大约需要半分钟，请稍候。';
      try {
        const r = await fetch('/api/digest', { method: 'POST' });
        const data = await r.json();
        if (!r.ok) { throw new Error(data.error || '生成失败'); }
        raw = data.digest;
        result.innerHTML = marked.parse(raw);
        result.style.display = 'block';
        copy.style.display = 'inline-block';
        statusEl.textContent = '生成时间：' + new Date(data.generatedAt).toLocaleString('zh-CN');
      } catch (e) {
        statusEl.className = 'err'; statusEl.textContent = '出错了：' + e.message;
      } finally {
        go.disabled = false;
      }
    });
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(raw);
      copy.textContent = '已复制 ✓';
      setTimeout(() => (copy.textContent = '复制全文'), 1500);
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**（提交约定）

Message:
```
feat: 新增前端页面（汇总按钮 + 结果展示 + 复制）

合作：Claude Code Opus
```
add: `public/index.html`

---

## Task 6: 本地验证 + README

**Files:** Create `.dev.vars`, `README.md`

- [ ] **Step 1: 创建 `.dev.vars`（不提交，已在 .gitignore）**

内容（用户提供真实 key 替换）：
```
DEEPSEEK_API_KEY=sk-你的key
```

- [ ] **Step 2: 启动本地服务**

Run: `cd /d/code/demo/follow-builders-web && npx wrangler pages dev public`
Expected: 本地起服务（默认 http://localhost:8788）。

- [ ] **Step 3: 浏览器验证**

打开 http://localhost:8788，点「生成今日 AI 汇总」，约半分钟后应显示中文 digest（X / 博客 / 播客 三部分，含链接）。用 gstack-browse 或手动截图确认。

- [ ] **Step 4: 写 `README.md`**

```markdown
# Follow Builders 网页版

点一个按钮，生成当天的中文 AI 摘要（来自 follow-builders 公开 feed，由 DeepSeek 混编）。

## 本地运行
1. `npm install`
2. 新建 `.dev.vars`，写入 `DEEPSEEK_API_KEY=sk-...`
3. `npm run dev`，打开 http://localhost:8788

## 部署到 Cloudflare Pages
1. `npx wrangler pages deploy public`
2. 在 Cloudflare 控制台为该 Pages 项目添加环境变量 `DEEPSEEK_API_KEY`（加密）。
3. 打开分配的 `*.pages.dev` 网址验证。

## 成本
托管免费；每次点击调用一次 DeepSeek（按 token 计费，很便宜）。
```

- [ ] **Step 5: Commit**（提交约定）

Message:
```
docs: 新增 README 与本地运行说明

合作：Claude Code Opus
```
add: `README.md`

---

## Task 7: 部署到 Cloudflare（需用户参与）

- [ ] **Step 1: 确认 wrangler 登录**

Run: `npx wrangler whoami`
若未登录，提示用户在终端运行 `npx wrangler login`（需浏览器授权 Cloudflare 账号）。

- [ ] **Step 2: 部署**

Run: `cd /d/code/demo/follow-builders-web && npx wrangler pages deploy public`
Expected: 输出分配的 `https://<project>.pages.dev` 网址。

- [ ] **Step 3: 配置线上环境变量**

在 Cloudflare 控制台 → Pages 项目 → Settings → Environment variables，添加 `DEEPSEEK_API_KEY`（加密）。或用 `npx wrangler pages secret put DEEPSEEK_API_KEY`。

- [ ] **Step 4: 线上验证**

打开 `*.pages.dev`，点按钮确认能生成中文 digest。

- [ ] **Step 5（可选）: 绑定自定义域名**

在 Cloudflare Pages 项目 → Custom domains 绑定用户自己的域名/子域名。

---

## 验证清单（对照 spec）

- [x] 前端按钮 + 结果区 + 复制 → Task 5
- [x] 后端拉 feed/prompts + 调 DeepSeek → Task 4
- [x] key 用环境变量、不入代码库 → Task 1（.gitignore）+ Task 6/7
- [x] 中文输出、遵循 prompts → Task 2（buildMessages）
- [x] 错误处理（key 缺失 / 拉取失败 / 调用失败）→ Task 3、Task 4
- [x] 本地验证 + 部署 → Task 6、Task 7
- [x] 风险（字幕过长）：先完整跑，超限再截断 → 实现时在 Task 6 实测，必要时回到 digest-core 加截断
