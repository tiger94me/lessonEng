# 大模型 API 配置（2026-10-24 测试存档）

## 接入信息
- **Base URL**: `http://192.168.1.61:3425/v1`
- **API Key**: `sk-magpie-key-（已脱敏，完整值仅在内网使用）`
- **协议**: OpenAI 兼容（/v1/chat/completions）

## 测试结果：27 / 66 可用

### ✅ 可用模型
**workbuddy 系列（全部可用，推荐优先用）**
- workbuddy/glm-5.3、workbuddy/glm-5.3-flash、workbuddy/glm-5v-turbo
- workbuddy/deepseek-v4.1-flash、workbuddy/hy3、workbuddy/hy4-preview-f
- workbuddy/step-5-preview、workbuddy/auto

**workbuddy-ai 系列（全部可用）**
- workbuddy-ai/deepseek-v4.1-flash、glm-5.3-flash、hy3、minimax-m3.1-flash、step-5-preview

**auto 系列（部分可用）**
- auto/GLM-5.3、auto/GLM-5.2、auto/glm-5.3-flash
- auto/deepseek-v4.1-flash、auto/free、auto/efficient
- auto/step-5-preview、auto/beam-free、auto/glyph-cluster
- auto/hy3、auto/minimax-m3.1-flash、auto/nemotron-3.5-super-vl:free
- auto/xing4.0-29b-a4b:free、auto/flint-v1.0:free、group/cheap-first

### ❌ 不可用（39 个）
失败原因统一为 `Kilo Gateway 2: authentication token is invalid`，
即此 key 无 kilo 网关权限：
- auto/claude-opus-5.5、auto/gpt-6.1-sol、auto/kimi-k3(-pro)
- auto/mercury-3、auto/pareto-*、auto/glimpse、auto/muse-spark-open 等
- 全部 kilo-2/* 系列

## 复测命令
```bash
curl http://192.168.1.61:3425/v1/chat/completions \
  -H "Authorization: Bearer sk-magpie-key-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"workbuddy/glm-5.3-flash","messages":[{"role":"user","content":"hi"}]}'
```
