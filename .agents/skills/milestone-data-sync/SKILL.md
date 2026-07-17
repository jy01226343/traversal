---
name: milestone-data-sync
description: 实现目的地实时数据同步、Provider Adapter和SSE进度条。
---

# 施工任务：M3 数据同步子系统

## 核心原则（来自施工方案 §5）
- 必须后台任务化（BullMQ），前端只消费 SSE 进度。
- 严格区分来源优先级（官方API > 公开页面 > 编辑包）。
- 某模块失败（如天气挂掉）不能阻塞入境规则模块。

## 后端实现（apps/api/src/modules/sync）
1. **创建 BullMQ 队列**：`syncQueue`。
2. **实现 Provider Adapter 模式**：
   - 创建 `packages/providers/src/weather-open-meteo.ts`
   - 创建 `packages/providers/src/entry-rules-official.ts`
   - 每个 provider 必须实现 `fetch` 和 `normalize`。
3. **API 端点**：`POST /destinations/:slug/sync` 触发任务，返回 `jobId`。

## 前端 UI（apps/web/src/features/live-data）
应用 `ux-responsive-layout` 技能：
1. **进度条组件（<SyncProgress />）**：
   - PC端：显示详细的当前步骤文字（如“正在获取 25-50%: 入境与签证规则”）。
   - 移动端：仅显示百分比数字和一个环形进度（Circle Progress），点击后展开详情抽屉。
2. **来源透明度**：
   - 列表显示 `sourceRecords`。
   - 移动端默认只显示来源图标（`favicon`），PC端显示完整域名。
3. **错误处理**：Partial Failure 时，显示“部分成功”，并提供“重试失败模块（Retry Failed）”按钮。

## 🚨 验收标准（AC）
1. 点击同步，SSE 推送 0->100% 进度，页面不卡顿。
2. 关闭浏览器标签页，后台 BullMQ 继续执行，再次打开页面恢复进度（从Redis读取）。
3. 拔掉网线（模拟网络失败），UI 显示“网络错误”且不白屏。