# Follow Builders 网页版

点一个按钮，生成当天的中文 AI 摘要（X 动态 / 官方博客 / 播客）。内容来自 [follow-builders](https://github.com/zarazhangrui/follow-builders) 的公开 feed，由 DeepSeek 混编成中文。

## 本地运行

1. `npm install`
2. 新建 `.dev.vars`，写入一行：`DEEPSEEK_API_KEY=sk-你的key`
3. `npm run dev`，浏览器打开 http://localhost:8788

## 部署到 Cloudflare Pages

1. `npx wrangler pages deploy public`
2. 在 Cloudflare 控制台为该 Pages 项目添加环境变量 `DEEPSEEK_API_KEY`（加密）。
3. 打开分配的 `*.pages.dev` 网址验证；如需自定义域名，在 Pages 项目的 Custom domains 绑定。

## 工作原理

`functions/api/digest.ts` 拉取公开 feed 与 prompts，调用 DeepSeek（`deepseek-chat`）生成中文 digest，前端 `public/index.html` 点按钮请求并渲染。

## 成本

托管免费；每次点击调用一次 DeepSeek（按 token 计费，很便宜），不点不花钱。

## 测试

`npm test`（vitest）覆盖 feed 内容拼装与 DeepSeek 调用封装。
