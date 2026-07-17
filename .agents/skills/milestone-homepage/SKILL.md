---
name: milestone-homepage
description: 实现Family Atlas自适应首页（Journey Focus / World Explore）及双向切换。
---

# 施工任务：M2 自适应首页

## 前置条件
1. 运行 `@baseline-audit` 确认 `GET /api/v1/home/context` 接口是否存在。
2. 若不存在，按施工方案 §3.2 创建 `HomePreference` 模型。

## 路由与判定逻辑（无脑执行）
创建 `apps/web/src/features/home`，实现：
- `resolvedMode = JOURNEY` -> 渲染 `<JourneyFocusHome />`
- `resolvedMode = WORLD` -> 渲染 `<WorldExploreHome />`
- 顶部导航栏增加模式切换器（地球图标 / 旗帜图标），调用 `PUT /preference`。

## 组件拆分（严格按施工方案 §6）
### JourneyFocusHome（旅程指挥中心）
**布局**：左（60%）右（40%）分栏，移动端变为上下结构。
**必须包含**：
1.  **封面与进度**：右上角显示状态徽章（Planning/Ongoing）和倒计时。
2.  **核心焦点（Next 3 Actions）**：从准备清单中提取最重要的3项未完成任务，做成大按钮卡片（应用 `ux-responsive-layout` 的焦点原则）。
3.  **数据同步入口**：显示天气/签证更新时间，放置“刷新”按钮。
4.  **缩略地球**：右下角悬浮一个小型3D地球（`<MiniGlobe />`），点击即切换到 World Explore。

### WorldExploreHome（世界探索）
**布局**：全屏3D地球（Cesium），UI控件使用 `absolute` 定位。
**必须包含**：
1.  **浮动继续旅程卡**：如果有未完成Journey，屏幕底部出现上滑卡片（`Continue Journey`），否则隐藏。
2.  **足迹六态**：在地球上渲染施工方案 §6.2 规定的六种颜色状态。

## 🚨 验收标准（AC）
1. 新用户打开 -> 看到地球（无报错）。
2. 创建一个 Draft Journey -> 刷新页面 -> 自动跳转 Journey Focus。
3. 在移动端（iPhone SE模拟器）测试：顶部切换器不换行，底部卡片不遮挡地球操作。
4. 运行 `pnpm test:home` 通过。