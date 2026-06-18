# Follow Builders 网页版 · AI Builders Digest

点一个按钮，生成当天的中文 AI 摘要（X 动态 / 官方博客 / 播客）。
内容实时来自开源项目 [follow-builders](https://github.com/zarazhangrui/follow-builders) 已抓好的公开 feed，由 **DeepSeek** 在浏览器里混编成一份简体中文 digest。

零后端、零构建、零数据库：整站只有一个 `public/index.html`，托管在 Cloudflare Pages。

---

## 这是什么

[follow-builders](https://github.com/zarazhangrui/follow-builders) 是一个上游开源项目，它负责**采集**：定时抓取一批 AI 顶尖建造者的 X 推文、播客转录、官方博客，产出一组 JSON feed 和一套生成 digest 用的 prompt，全部公开在仓库里。

**本项目不重复采集**，而是把上游的成果直接变成一个网页：进页面 → 勾选想看的来源 → 填自己的 DeepSeek Key → 点「生成」，浏览器实时拉取上游 feed 与 prompt，直连 DeepSeek 生成中文摘要并渲染出来。

---

## 改造说明

这是你最关心的部分，分两层：**相对上游做了什么**、**项目自身怎么一步步演进到现在**。

### 一、相对上游 follow-builders 的改造

| 维度 | 上游 follow-builders | 本项目（网页版） |
|---|---|---|
| 定位 | 数据采集 + 命令行生成 | 一键生成的网页前端 |
| 数据 | 自己抓取并存成 JSON | **不抓取**，实时复用上游已抓好的 feed |
| Prompt | 仓库里的 `prompts/*.md` | **实时拉取**上游同一套 prompt，不自己维护 |
| 运行方式 | 本地脚本 / CI | 浏览器打开即用，无需环境 |
| Key | 跑脚本者自备 | 用户在页面填，存自己浏览器 |

一句话：**上游负责「抓数据 + 定规则」，本项目负责「让任何人在浏览器里一键用起来」。** feed 和 prompt 都指向上游 `main` 分支实时获取，上游更新即时生效。

### 二、项目自身的演进（按提交顺序）

1. **初版 · 后端代理架构**（`d355402`）
   前端调用 Cloudflare Pages Function `functions/api/digest.ts`，由它在服务端拉 feed/prompt、调 DeepSeek。Key 存在服务器环境变量 `DEEPSEEK_API_KEY`，模型为 `deepseek-chat`。

2. **改为前端直连**（`312040b`）
   去掉对后端的依赖：改由 `public/index.html` 在浏览器里直接拉 feed/prompt、直连 DeepSeek。Key 改存浏览器 `localStorage`，不再经过本站服务器。信息源此时只是**只读展示**。

3. **信息源可勾选 + 固定最强模型**（`79c2028`，当前）
   - 信息源从只读列表改成**可勾选清单**：每组一个「全选」复选框（支持半选态），勾选即时存 `localStorage`。
   - **移除了所有生成参数 UI**（原本可调模型 / temperature / max_tokens / 超时）。现在固定用最强模型，参数取稳健默认值，页面只剩「填 Key + 勾选来源 + 点生成」三步。

> **遗留说明**：经过第 2 步后，`functions/api/digest.ts` 与 `src/deepseek.ts`（后端代理路径）已成为**孤儿**——前端不再调用它们，且其中模型仍是旧的 `deepseek-chat`。它们作为可选的「服务端代理」备用实现保留，部署时会被打包成一个 Pages Function，但默认走不到，无副作用。

---

## 工作原理（数据流）

```
进页面
  └─ 拉 config/default-sources.json（订阅全集）→ 渲染可勾选清单

点「生成」
  ├─ 并行拉 feed-x.json / feed-podcasts.json / feed-blogs.json（实际抓到的内容）
  ├─ 并行拉 prompts/*.md（5 段输出规则）
  ├─ filterFeeds(全部内容, 勾选集)   → 只留勾选的来源
  ├─ formatFeedContent(...)          → 拼成原始文本块
  ├─ buildMessages(...)              → 组装 system / user 消息（见下节）
  ├─ POST api.deepseek.com/chat/completions（带你的 Key）
  └─ marked 渲染返回的 Markdown
```

- 上游根地址：`https://raw.githubusercontent.com/zarazhangrui/follow-builders/main`
- DeepSeek 端点：`https://api.deepseek.com/chat/completions`（OpenAI 兼容）
- 固定生成参数（不在页面暴露）：

  ```js
  const GEN = { model: 'deepseek-v4-pro', temperature: 0.6, maxTokens: 32768, timeoutSec: 120 };
  ```

  超时用 `AbortController`，超过 120 秒提示重试。

---

## 模型输出规则

这是你的第二个问题：**模型按什么规则输出内容**。规则全部在 `buildMessages()` 里组装成两条消息（`src/digest-core.ts` 与 `public/index.html` 内联各一份，逻辑一致）。

### system 消息 = 固定约束 + 5 段上游规则 + 固定收尾

```
你是 AI 行业资讯的中文编辑。严格依据提供的原始内容做混编摘要，不得编造，每条必须保留原始链接。
输出整份简体中文 digest。遵循以下规则：

## 整体格式   ← 上游 prompts/digest-intro.md
## 推文摘要   ← 上游 prompts/summarize-tweets.md
## 博客摘要   ← 上游 prompts/summarize-blogs.md
## 播客混编   ← 上游 prompts/summarize-podcast.md
## 中文风格   ← 上游 prompts/translate.md

标题用："AI Builders Digest · {当天日期}"。
顺序：X / Twitter、官方博客、播客。
结尾加一行："通过 Follow Builders 生成"。不要使用破折号。
```

- **三条硬约束**（本项目固定写死）：① 中文编辑人设；② 只依据原始内容、**不得编造**；③ **每条必须保留原始链接**。
- **五段分项规则**（`## 整体格式 / 推文摘要 / 博客摘要 / 播客混编 / 中文风格`）的正文**不在本仓库**，而是生成时从上游 `prompts/*.md` 实时取回拼接。想看 / 调整规则正文，去上游对应 `.md` 文件即可，本项目随上游更新。
- **收尾约束**（本项目固定写死）：统一标题格式、固定板块顺序、固定落款、禁用破折号。

### user 消息 = 引导语 + 过滤后的原始 feed 文本

```
以下是今天的原始 feed 内容，请据此生成中文 digest：

===TWEETS===
## {作者} (@{handle})
- {推文文本}
  URL: {链接}
...
===BLOGS===
## {来源}: {标题}
URL: {链接}
BODY:
{正文}
...
===PODCAST===
## {播客}: {标题}
URL: {链接}
TRANSCRIPT:
{转录}
```

每条都带原始 URL，配合 system 里的「保留原始链接」约束，确保产出可溯源。

### 取结果

读取 `choices[0].message.content`，交给 `marked` 渲染为 HTML。空内容、非 200、超时都会在页面给出明确中文提示。

---

## 信息源勾选与过滤

- **可选项**来自上游 `config/default-sources.json`（订阅全集，会随上游增减）。
- **实际纳入**的内容 = 勾选集 ∩ 当天 feed 实际抓到的内容。
- 过滤键：X 按 `handle`，播客 / 博客按 `name`（见 `filterFeeds`）。
- 勾选状态存 `localStorage['fb_selected_sources']`：
  ```json
  { "x": ["karpathy"], "podcasts": ["Training Data"], "blogs": ["Claude Blog"] }
  ```
- 判定规则：本地有该源记录按记录；**无记录**（上游新增的源）默认勾选，避免漏掉新源。
- 三组全空时点生成 → 提示「请至少选择一个信息源」，不调用 DeepSeek。

---

## 本地运行

```bash
npm install
npm run dev          # = wrangler pages dev public
```

打开终端输出的地址（默认 http://localhost:8788）。Key 在页面里填即可，**不需要** `.dev.vars` 或任何环境变量——当前是前端直连。

> 仅当你想跑那条孤儿的服务端代理（`functions/api/digest.ts`）时，才需要新建 `.dev.vars` 并写入 `DEEPSEEK_API_KEY=sk-...`。默认前端不会走它。

DeepSeek Key 在 [platform.deepseek.com](https://platform.deepseek.com) 获取。

---

## 部署到 Cloudflare Pages

```bash
npm run deploy       # = wrangler pages deploy public
# 或显式指定项目名：
npx wrangler pages deploy public --project-name=follow-builders-web
```

- **无需**在 Cloudflare 配置任何环境变量（前端直连，Key 在用户浏览器里）。
- 部署后访问分配的 `*.pages.dev`；如需自定义域名，在 Pages 项目的 Custom domains 绑定。
- 当前线上：<https://follow-builders-web.pages.dev> ／ <https://follow-builders.dengjiabei.cn>

---

## 项目结构

```
public/index.html              唯一的运行单元：前端直连 DeepSeek（UI + 全部逻辑）
src/digest-core.ts             纯函数：filterFeeds / formatFeedContent / buildMessages（+ 类型）
src/digest-core.test.ts        上述纯函数单测
src/deepseek.ts                ⚠ 孤儿：后端代理用的 DeepSeek 封装（模型仍为 deepseek-chat）
src/deepseek.test.ts           callDeepSeek 单测
functions/api/digest.ts        ⚠ 孤儿：早期服务端代理（前端不再调用，部署会打包但走不到）
wrangler.toml                  Pages 配置（name=follow-builders-web，输出目录=public）
docs/superpowers/specs/        设计文档（含初版设计与配置增强方案）
```

> `src/digest-core.ts` 是逻辑的「单一真相」：被 `index.html` 内联镜像、被孤儿后端引用、被单测覆盖。改输出逻辑时三处需保持一致。

---

## 测试与类型检查

```bash
npm test             # vitest：覆盖 filterFeeds / formatFeedContent / buildMessages / callDeepSeek
npx tsc --noEmit     # 类型检查
```

---

## 隐私与成本

- **隐私**：DeepSeek Key 只存在你这台浏览器的 `localStorage`，生成时直接发给 DeepSeek，**不经过本站服务器、不上传任何第三方**。
- **成本**：Cloudflare Pages 托管免费；每次点「生成」调用一次 DeepSeek，按 token 计费（很便宜），不点不花钱。
