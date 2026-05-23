# Follow Builders 网页版 — 设计方案

日期：2026-05-23

## 目标

给用户现有网站增加一个「AI 汇总」功能：打开页面点一个按钮，几十秒后看到当天的中文 AI 摘要（X 动态 / 官方博客 / 播客三部分）。内容来自 follow-builders 的公开 feed，由 DeepSeek 按既定 prompt 混编成中文。

## 怎么用（用户视角）

1. 打开网页，看到标题 +「生成今日 AI 汇总」按钮 + 结果区。
2. 点按钮 →「正在生成…」loading（约 30 秒）→ 显示中文 digest（含日期）。
3. 「复制」按钮一键复制全文，方便转发。

## 架构

- 部署：Cloudflare Pages（静态前端）+ Pages Functions（后端 serverless）。
- 前端：单页 `index.html`（原生 HTML/CSS/JS，无框架，UI 极简）。包含按钮、loading、结果区、复制按钮、错误提示。
- 后端：Pages Function `functions/api/digest.ts`（TypeScript）。
  - `POST /api/digest`：
    1. 并行 fetch 三个 feed（feed-x / feed-podcasts / feed-blogs.json）+ 五个 prompt 文件（GitHub raw）。
    2. 组装 LLM 输入：system = digest-intro + 各 summarize prompt + translate（中文）规则；user = feed 内容（推文 / 博客 / 播客字幕）。
    3. 调 DeepSeek：`POST https://api.deepseek.com/chat/completions`，model `deepseek-chat`，Authorization 用环境变量 `DEEPSEEK_API_KEY`。
    4. 返回 `{ digest: string, generatedAt: string }`。
- 密钥：`DEEPSEEK_API_KEY` 存 Cloudflare Pages 环境变量（加密），绝不进前端或代码库。

## 数据流

浏览器点按钮 → `POST /api/digest` → Function 拉 feed + prompts → 调 DeepSeek → 返回中文 digest → 前端把 markdown 渲染成 HTML 展示。

## 关键细节

- feed 与 prompts 来源：`https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/...`（公开，与本机脚本一致）。
- 语言固定中文（zh），遵循 `translate.md`：人名 / 公司 / 产品 / 技术术语保留英文、不用破折号、语气口语化。
- 模型：`deepseek-chat`（DeepSeek-V3，中文强、便宜、128K context）。
- 结果区显示生成日期。

## 错误处理

- feed / prompts 拉取失败：返回错误，前端提示「内容拉取失败，请稍后重试」。
- DeepSeek 调用失败 / 超时：前端提示「生成失败，请重试」，并展示原因（如 key 未配置 / 额度不足）。
- `DEEPSEEK_API_KEY` 未配置：Function 返回明确错误。
- 前端按钮在生成期间禁用，防止重复点击。

## 风险与应对

- **播客字幕过长**：单期字幕约 7 万字符（约 2-3 万 token），加其它 feed 总输入可能 4-6 万 token。`deepseek-chat` 上下文 128K，理论可容纳。
  - 应对：先按完整内容跑通；若触发 context 超限或超时，则对播客字幕截断（保留前 N 万字符），或先让模型压缩字幕再混编。实现时实测 token 量。
- **响应时间**：生成长摘要可能 20-40 秒。前端 loading + 合理超时（约 90 秒）；确认在 Cloudflare Functions 时长限制内（以 I/O 等待为主，不计 CPU 时间）。

## 成本

- Cloudflare Pages：免费额度足够。
- DeepSeek：每次点击调用一次，约几分钱（按 token，DeepSeek 价格低）。无定时、不点不花钱。

## 非目标（YAGNI）

- 不做定时自动推送、不做邮件、不做用户登录、不做来源筛选。以后想要再加。
- 不做缓存（每次点击实时生成最新）。如需省钱可后续加「当天结果缓存」。

## 验证

- 本地 `wrangler pages dev` 跑通，点按钮看到中文 digest。
- 部署到 Cloudflare 后，线上点按钮再验证一次。
