# AGENTS.md — 给后续 AI 会话的项目约定

## 🔑 凭据状态（2026-10-26 已修复）

`MAGWORKBUDDY_API_KEY` 此前报 401（key 被禁用），现已重新配置并**实测可用**：

- provider：`magworkbuddy`
- 模型：`group/myworkbuddy`（Base URL `http://192.168.1.61:3425/v1`）
- 网关后端实际路由到 `deepseek-v4.1-flash`，中文编程问答正常
- 凭据文件：`~/.dsh/.credentials.yaml`（`refs.MAGWORKBUDDY_API_KEY`），该文件被 chokidar 热监听，改完即生效，无需重启

## ⚠️ 模型切换规则（用户明确要求）

> **一旦任务涉及程序修改（写代码、改文件、修 bug、跑测试、提交 git），
> 优先请求切换到 `magworkbuddy / group/myworkbuddy` 模型，不要沿用当前默认模型。**

原因：用户认为 myworkbuddy 在编程任务上更合适。

### 执行方式

全局默认模型**故意保持** `mag / group/cheap-first`（用户选择不改全局），
所以切换必须由 agent 主动发起：

1. 识别到任务是「程序修改」类时，第一句话就向用户提出：
   「这个任务要改程序，建议切到 `magworkbuddy / group/myworkbuddy`，你确认下？」
2. 用户确认后，在 Web GUI 的模型选择器里选 `magworkbuddy / group/myworkbuddy`，
   或由用户告知已切换，然后继续干活。
3. 如果用户说「不用切」「继续」，就沿用当前模型往下做，不要反复追问。

### 当前默认模型

- 全局默认：`mag / group/cheap-first`（未改动，见 `~/.dsh/profiles/web/cordis.patch.yml` 的 `agent-default-model`）
- 编程任务首选：`magworkbuddy / group/myworkbuddy`（本文件约定）

## 项目背景

外研社五年级上册 Unit 3《Happy together》英语课文学习应用（纯前端、离线可用）。
面向小学生，交互要"有趣"优先：动画反馈、游戏化、鼓励式文案。

- 服务地址：http://eng.fjcc.eu.org （本地 `python3 -m http.server` 直接读文件，不依赖 GitHub）
- GitHub 仓库：tiger94me/lessonEng —— 本地 SSH key 属于 WuDigithub8，**无推送权限**，
  需要用户提供 token 或加协作者才能推送。
- 测试：`node test.js`（逻辑冒烟）、`node .cdp-phrase-test.js`（游戏端到端）、
  `node .cdp-cannon-test.js`（大炮答题端到端）
