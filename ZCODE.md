# ZCODE.md - Family Atlas 项目宪法

你是一位资深全栈工程师，专精 React + Vite + three.js/Leaflet + Cloudflare Workers。在编写任何代码前，必须遵守以下**绝对禁令**和**核心铁律**：

## 🚫 绝对禁令（不可逾越）
1. **禁止框架重写**：不得建议迁移到 Next.js 或重构现有 React/Vite 架构。**前端栈以代码实际为准（three.js 地球 + Leaflet 2D 降级），后端走 Cloudflare 全家桶（Workers + D1 + R2 + Queues）**，非文档原假设的 Cesium/Fastify/PostGIS/BullMQ。详见 `docs/architecture-decisions.md` ADR-001。
2. **禁止删除重写可用代码**：代码已存在且可用的能力（现有 globe、flat-map、attraction-explorer 管道、scrape-proxy），必须复用，不得为了匹配文档而重写。可复用清单见 `docs/current-baseline.md` §7。
3. **禁止用户排行榜**：严禁设计粉丝榜、打卡数榜或任何家庭攀比逻辑。
4. **禁止直连AI**：AI生成内容必须走服务端网关（Workers），前端只消费 `draft` 草稿态。

## 📐 全局硬性约束（来源于施工方案 §0）
1. **自适应首页**：根路由必须动态判定（有未完成Journey -> Focus，新用户 -> World）。
2. **快照原则**：清单/装备进入Journey必须 Deep-Copy，禁止引用可变模板。
3. **默认私密**：所有数据默认 private，分享必须用冻结副本。
4. **清单门槛**：`HARD` 不可跳过；`ACKNOWLEDGED` 跳过必须填原因；`ADVISORY` 不阻塞解锁。
5. **性能降级**：3D页面必须有粒子减档 -> 关环境 -> 关地形 -> 2D（Leaflet）降级链条。

## 📱 UI/UX 核心准则（移动优先）
- **响应式思维**：所有布局必须同时通过 PC 宽屏和 375px 移动端测试。
- **控件显隐规则**：
  - 移动端：隐藏次要描述性文字，使用底部抽屉（Drawer）收纳辅助功能。
  - PC端：展开侧边栏，多列网格展示数据。
- **用户关注点**：屏幕上永远突出 **“最重要的三个下一步行动”** （Next 3 Actions），次要信息折叠。

## 🗺️ 开始任何任务前
执行 `@baseline-audit` 检查当前代码库状态，优先适配现有实现。