# Follow Builders 网页版 — 配置增强设计方案

日期：2026-06-17

## 背景

当前页面（`public/index.html`，前端直连 DeepSeek 路径）已支持配置 DeepSeek key 与只读展示信息源。本次在此基础上完善两类配置能力：

1. **可自定义信息源**：用户勾选 / 增删纳入摘要的 X 账号、播客、博客。
2. **DeepSeek 生成配置**：模型、temperature、max_tokens、请求超时。

数据来源仍是上游 [follow-builders](https://github.com/zarazhangrui/follow-builders) 的公开 feed 与 `config/default-sources.json`，前端实时拉取。

## 关键事实：订阅全集 vs 实际内容

- `config/default-sources.json` 是**订阅全集**（当前 26 个 X 账号 / 6 播客 / 2 博客），作为用户可勾选的选项来源。
- `feed-x.json` / `feed-podcasts.json` / `feed-blogs.json` 是**实际抓取到的内容**，只含 lookback 窗口内有更新的子集（如本次 16 X / 1 播客 / 1 博客）。
- 字段对应关系（已核实）：

| 类型 | default-sources 字段 | feed 字段 | 过滤键 |
|---|---|---|---|
| X | `x_accounts[].handle` | `feed-x.json` 的 `x[].handle` | `handle` |
| 播客 | `podcasts[].name` | `feed-podcasts.json` 的 `podcasts[].name` | `name` |
| 博客 | `blogs[].name` | `feed-blogs.json` 的 `blogs[].name` | `name` |

- 生成纳入内容 = **勾选集（来自全集）∩ feed 实际内容**。可选项用全集展示，过滤作用在 feed 上。

## 范围

作用文件：

- `public/index.html`：UI 与前端直连交互。
- `src/digest-core.ts`：新增 `filterFeeds` 纯函数。
- `src/digest-core.test.ts`：新增过滤逻辑单测。

不做：

- 不改 `functions/api/digest.ts`（当前前端已不调用它，仍为孤儿；统一架构属于后续，不在本次范围）。
- 不引入框架 / 构建步骤。
- 不在本次处理 marked 的 XSS 面与 CDN 无 SRI（与本功能无关，另开）。

## 功能①：可自定义信息源

### 数据流

进页面：并行拉 `default-sources.json`（全集 → 渲染勾选项）与三个 feed（生成时用）。

### UI

将现有只读「在追踪的信息源」`details` 改为可勾选清单：

- 三组：X / Twitter、播客、官方博客。
- 每项一个 checkbox（label 为名称，X 额外显示 `@handle`）。
- 每组提供「全选 / 清空」。
- 勾选变化即写入 localStorage。

### 持久化

`localStorage['fb_selected_sources']`，结构：

```json
{ "x": ["karpathy", "swyx"], "podcasts": ["Training Data"], "blogs": ["Claude Blog"] }
```

- 读取时机：进页面。无记录 → 默认全选（用 default-sources 全集生成初始勾选集）。

### 与上游变化的兼容

default-sources 是上游实时拉取、会变。某源是否勾选的判定规则：

- 渲染勾选项始终基于最新 default-sources 全集。
- 本地勾选集**有该源记录**时按记录；**无记录**（上游新增的源）时默认勾选 —— 贴合「默认全选」语义，避免漏掉新源。
- 上游移除的源自动从勾选集消失。

### 生成时过滤

`filterFeeds(feeds, selection)`：

- `x`：保留 `selection.x.includes(builder.handle)` 的 builder。
- `podcasts`：保留 `selection.podcasts.includes(p.name)`。
- `blogs`：保留 `selection.blogs.includes(b.name)`。
- `handle` / `name` 缺失的条目跳过（不纳入）。

过滤后 → `formatFeedContent` → `buildMessages` → 调 DeepSeek。

### 边界

- 三组全空（用户清空所有）→ 生成前提示「请至少选择一个信息源」，不调用 DeepSeek。
- 勾选了但 feed 中无该项 → 自然不出现，无错误。

## 功能②：DeepSeek 核心四项配置

新增可折叠「生成参数」`details`（默认折叠，保持极简），存 `localStorage['fb_gen_config']`：

```json
{ "model": "deepseek-chat", "temperature": 0.6, "maxTokens": 8000, "timeoutSec": 90 }
```

| 配置 | 默认 | 范围 / 说明 |
|---|---|---|
| `model` | `deepseek-chat` | 可选 `deepseek-reasoner` |
| `temperature` | `0.6` | 0–2；选 reasoner 时禁用该输入（reasoner 不支持，会被忽略） |
| `maxTokens` | `8000` | 正整数；reasoner 可调大 |
| `timeoutSec` | `90` | 请求超时秒数，用 `AbortController` |

### 模型差异处理

- 取结果仍用 `choices[0].message.content`（reasoner 的最终答案在 `content`，思维链在 `reasoning_content`，忽略即可）。
- 选 reasoner 时前端禁用 temperature 输入。

### 超时

用 `AbortController` + `setTimeout(timeoutSec * 1000)`；触发 abort → 提示「生成超时（超过 N 秒），请重试或调大超时」。

## 可测纯函数与测试

`src/digest-core.ts` 新增：

```ts
export interface SourceSelection { x: string[]; podcasts: string[]; blogs: string[]; }
export function filterFeeds(feeds: Feeds, selection: SourceSelection): Feeds
```

`src/digest-core.test.ts` 新增用例：

- 按 `handle` 过滤 X（保留选中、剔除未选）。
- 按 `name` 过滤播客 / 博客。
- 空 selection（某组为空）→ 该组返回空数组。
- selection 含不存在的 handle / name → 不报错、不误纳入。
- 条目缺 `handle` / `name` → 跳过。

`index.html` 内联一份等价 JS 的 `filterFeeds`，与 src 版本保持一致（同现有 `formatFeedContent` / `buildMessages` 的处理方式）。

## 错误处理

- 沿用 `try/catch` + `#status` 文案提示。
- 新增：未选源、请求超时两类明确提示。
- feed / prompts / sources 拉取失败：沿用现有「加载失败」提示。

## 持久化键一览

| key | 内容 |
|---|---|
| `fb_deepseek_key` | DeepSeek API key（现有） |
| `fb_selected_sources` | 信息源勾选集（新增） |
| `fb_gen_config` | 生成参数（新增） |

## 验证

- `npm test`：`filterFeeds` 单测通过。
- `npx tsc --noEmit`：类型检查通过。
- `npm run dev` 本地：勾选 / 取消信息源、切换模型 / 改参数 / 改超时后点生成，确认行为正确；清空全部源时出现提示。

## 非目标（YAGNI）

- 不做统一前后端架构（孤儿 `digest.ts` 本次不动）。
- 不做定时推送、缓存、登录。
- 不做 marked 安全加固 / SRI（另开）。

## 后续可选项

- 统一架构、消除 `index.html` 与 `digest.ts` 的逻辑重复。
- 安全加固：marked sanitize、CDN 锁版本 + SRI。
