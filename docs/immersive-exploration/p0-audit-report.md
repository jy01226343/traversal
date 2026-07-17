# 沉浸式景点探索 · P0 仓库审计报告

> 审计日期：2026-07-17，基于工作区 HEAD `b144022`。
> 依据：《Agent 施工方案 V1.1》§2、《最终施工清单 V1.1》P0。
> 结论：**无阻塞项，直接施工。** 审计完成后按 P1–P9 继续。

## 1. 现有技术栈

- 前端：React 18 + Vite + TypeScript（`allowJs`，入口 `src/main.jsx` 单文件 App，1018 行）+ three.js ^0.185 + Leaflet ^1.9 + Tailwind v4 + GSAP。
- 后端：Cloudflare Worker（`worker/index.ts`，`/api/*` 路由）+ D1 + R2；前端部署为 Worker Static Assets SPA。
- 测试：Vitest 4 + jsdom + @testing-library/react，测试与源码同目录。**无 Playwright**（E2E 以 RTL 组件级集成测试替代，见 §11 风险）。
- 包管理：npm（package-lock.json）。**无 zustand / react-router / @tanstack**。
- 构建：`npm run build` 绿；`npm run test:run` 绿；`npm run typecheck` 绿（施工前已验证基线）。

## 2. 现有地图入口

- 状态机 `mapLevel ∈ world|continent|country|region`（`src/main.jsx:73`）。
- 3D：`src/components/ui/cobe-globe-weather.tsx`（raw three.js，含质量档与 reducedMotion 支持）。
- 2D：`src/components/ui/flat-atlas-map.tsx`（Leaflet，`onAttractionSelect` 回调，`selectedAttraction` 高亮）。
- 舞台：`atlasStage`（`src/main.jsx:828`），移动端由 `MobileAtlasShell`（三档抽屉 peek/browse/detail）包裹，桌面端直接渲染（`main.jsx:858`）。

## 3. 现有 POI 数据

- `src/features/attraction-explorer/`：完整 5 层 fallback 管道（Live API→爬虫→localStorage 快照→官方种子→区域目录）。
- `Attraction` 类型（`types.ts:5-29`）：WGS-84 坐标、category_l1/l2、tags、data_source/source_url/score_basis、last_updated。**无 sceneFamily/shape 场景字段**——由本功能新增适配器推断 + 策展配置覆盖，不改动原类型（向后兼容）。
- `resolveAttractions(countryCode?, regionId?, options?)`（providers.ts:161）；`AttractionExplorerPanel` onSelect → `setSelectedAttractionId`（main.jsx:874）。

## 4. 现有 Journey / 心愿 / 准备入口

- 心愿：`src/data/destination-status.ts` `loadWishlist/saveWishlist/toggleId`（localStorage `atlas-wishlist-v1`）。
- Journey：`src/features/explore/home-context.ts` `createJourney/updateJourney/fetchJourneyStops/createJourneyStop`；`JourneyStop.attractionId` 已支持绑定景点；`main.jsx` `addSelectedAttractionToJourney`（L735-752）为现成接入点。
- 准备：`src/data/unlock-destinations.ts` `getUnlockProfile(item)` + `main.jsx` unlock 弹窗（`setUnlockTarget`/`setUnlockOpen`）。
- 首页模式：`resolveHomeMode`（home-mode.ts:22）4 态；`DestinationLivePanel`（live-data）展示 Open-Meteo 实况层（来源+更新时间齐备，其余层显式 unavailable，不造假——与施工方案 §10 口径一致）。

## 5. 现有埋点体系

**无。** 全仓 grep 无任何 analytics/track 上报通道（仅 console.info 调试日志）。
→ 决策：新建最小埋点抽象 `analytics/immersive-events.ts`：`trackImmersiveEvent(name, params)` → console.debug + localStorage 环形缓冲 `atlas-immersive-events-v1`（上限 500 条，可查询漏斗），预留 `flushToEndpoint` 注入点，不新建第二套上报通道之外的平行体系。

## 6. 可复用模块（禁止重写）

| 模块 | 复用方式 |
|---|---|
| three.js 地球 / Leaflet 地图 | 沉浸层叠加其上；返回时恢复快照 |
| attraction-explorer 管道 | POI 来源；沉浸对象由 Attraction 适配生成 |
| DestinationLivePanel / fetchDestinationLiveData | 沉浸层「当前实况」数据源（来源+updatedAt） |
| resolveGlobeQuality / reducedMotion 链路 | 沉浸场景低性能/低动态模式直接复用同一输入 |
| MobileAtlasShell 断点（760px） | 沉浸层响应式断点与其一致 |
| home-context Journey API | 总结页「加入 Journey」真实入口 |
| destination-status 心愿 API | 总结页「加入心愿」真实入口 |
| unlock-destinations | 总结页「查看准备事项」真实入口 |

## 7. 需要新增模块

全部位于 `src/features/immersive-exploration/`（新目录，不改写既有文件）：

- `domain/` 类型契约、Schema 校验、选择器（预览优先级/标签上限）、动态适配引擎
- `state/` 沉浸状态机（10 态）+ React store（feature-local useReducer，**不引入 zustand**）
- `runtime/` 场景/转场/锚点/主题/风险 5 个控制器
- `scenes/` 场景注册表 + mountain/waterside/underwater 三套程序化 three.js 场景
- `data/` Attraction→ExplorationEntity 适配器 + 黄金样例三件套 + positionRef 校验器
- `analytics/` 埋点抽象
- `ui/` ImmersiveOverlay 等 8 个组件 + `immersive-exploration.css`
- `src/main.jsx` 集成：入口 CTA、地图快照、Feature Flag、业务回调（唯一被修改的既有文件）

## 8. 计划修改 / 新增文件

- 修改：`src/main.jsx`（仅追加沉浸入口与 overlay 渲染，不改既有流程）；`docs/immersive-exploration/*`（本报告与交付报告）。
- 新增：`src/features/immersive-exploration/**`（约 40 文件，详见 CONTRACT.md）。
- 删除：无。

## 9. 技术复用 / 补充决策表

| 决策点 | 结论 | 理由 |
|---|---|---|
| 3D 方案 | 复用 three.js（raw，同 cobe-globe-weather 模式） | 施工方案 §2.2：已有三维能力则不换；不引 react-three-fiber |
| 全局状态 | feature-local `useReducer + Context` | 仓库无全局状态框架；不为单功能新建第二套框架（§2.2-5） |
| 路由 | 不引入 react-router；沉浸层为条件渲染 overlay | 与现有 `mapLevel` 条件渲染一致 |
| 新依赖 | **零新增** | package.json 不动 |
| 场景资产 | 程序化生成（地形/水面/粒子），无外部模型/纹理 | 性能预算 ≤8MB；离线可构建 |
| 埋点 | 新建最小 track 抽象 + localStorage 缓冲 | 仓库无既有体系，§11.4 强制要求 |
| E2E | RTL 组件级集成测试覆盖 §13.3 十用例 | 无 Playwright；见 §11 风险 |

## 10. 性能预算表（§12.5 基线填定）

| 指标 | 预算 | 实测 | 状态 |
|---|---|---|---|
| 点击锚点 → 抵达首帧（中端移动） | ≤ 2.5 s | P9 实测填录 | 待验 |
| 稳态渲染帧率 | ≥ 30 fps | P9 实测填录 | 待验 |
| 单场景资源总量（不含底图与已有 three.js bundle） | ≤ 8 MB | 程序化资产 ≈ 0（零外部模型/纹理） | ✅ 设计即达标 |
| 沉浸会话内存峰值 | ≤ 设备可用内存 40% | P9 实测填录 | 待验 |
| 低性能模式 | 自动关粒子/后处理，保留全部信息能力 | 复用 resolveGlobeQuality 档位 | 设计中 |
| 增强效果整体关闭 | 不影响信息完整性（等价图文页） | FallbackInfoView | 设计中 |

豁免记录：无（截至 P0）。

## 11. 主要风险

1. **Playwright 缺失**：§13.3 E2E 以 jsdom + RTL 集成测试替代（场景渲染以 SceneHandle stub 注入），真实设备性能实测（预算表前两项）无法在本环境完成 → 交付报告中列为未完成项，附手动验证步骤。
2. **Attraction 模型无场景字段**：通过适配器推断（category/tags → sceneFamily/shape）+ 黄金样例策展覆盖；推断失败的对象走标准图文降级页，不阻塞。
3. **worker 无 /v1/attractions**：沉浸首期数据全部来自前端 5 层 fallback 与策展配置，不依赖该端点。
4. **main.jsx 单文件集成冲突**：集成改动控制在追加式（新 state + 新 overlay 渲染分支），不重构既有逻辑；出问题单独回滚该文件。

## 12. 回滚方式

- 功能级：Feature Flag `VITE_IMMERSIVE_EXPLORATION=off`（或 localStorage `atlas-immersive-exploration=off`）→ 入口隐藏、直达路径不可达，既有行为 100% 不变。
- 代码级：`git rm -r src/features/immersive-exploration/` + 还原 `src/main.jsx`（单文件 `git checkout`），即可完全回滚；无 schema/依赖/worker 变更。
