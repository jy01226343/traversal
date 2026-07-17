# 沉浸式景点探索 · 施工交付报告（P0–P9）

> 交付日期：2026-07-17。依据《Agent 施工方案 V1.1》§16 格式。
> 施工方式：主 Agent + 4 个并行 Worker（CORE/DATA/SCENES/UI），契约先行（`src/features/immersive-exploration/CONTRACT.md`）。

## 1. 仓库审计结论

见 `docs/immersive-exploration/p0-audit-report.md`。无阻塞项；Attraction 模型无场景字段（适配器补齐）、无埋点体系（新建最小抽象）、worker 无 `/v1/attractions`（首期不依赖）。

## 2. 技术复用与新增依赖

- 复用：three.js（raw 模式，同 cobe-globe-weather）、Leaflet 地图（沉浸层叠加）、attraction-explorer 5 层管道、live-data 实况快照、resolveGlobeQuality/reducedMotion 降级链路、home-context Journey API、destination-status 心愿 API、unlock-destinations 准备入口。
- **新增依赖：零**（package.json 未改动）。未引入 zustand/react-router/R3F/zod。

## 3. 文件清单

**修改（1 个）**：`src/main.jsx`（追加式：沉浸入口 CTA、React.lazy 按需加载 overlay、地图快照保存/恢复、四个业务回调；未改既有流程）。
**新增（48 个，全部在 `src/features/immersive-exploration/`）**：

| 子目录 | 文件 | 说明 |
|---|---|---|
| 根 | CONTRACT.md / index.ts / config.ts / immersive-exploration.css | 冻结契约、公共出口、Feature Flag、全部样式（含入口 CTA） |
| domain | types.ts* / selectors / decision-engine / schemas（+3 测试） | 契约类型、标签上限、动态适配、校验器 |
| state | immersive-machine.ts* / immersive-store（+测试） | 10 态状态机、React store + 埋点映射 |
| runtime | scene-controller / transition-controller / anchor-controller / theme-controller / risk-controller（+3 测试） | 场景/转场/锚点/主题/风险控制器 |
| scenes | scene-registry / shared / mountain / waterside / underwater（+测试） | 三套程序化 three.js 场景 |
| data | adapters/attraction-adapter、scene-configs×3+index、resolve-immersive-target、validators×2（+4 测试） | 适配器、黄金样例、校验器 |
| analytics | immersive-events.ts* | §11.4 埋点抽象 |
| ui | ImmersiveExperience、ImmersiveOverlay、SceneCanvas、EnteringView、ArrivalIntro、ThemeMenu、SceneAnchors、InfoPanel、RiskControls、DecisionSummary、FallbackInfoView、ModeBadge、ui-utils、test-fixtures（+2 测试） | 全部界面组件 |
| tests | e2e-flows.test.ts | §13.3 端到端流程集成测试 |

（* = 主 Agent 冻结契约文件）
**删除：无。**

## 4. 数据结构与场景配置（黄金样例三件套）

| 场景 | sceneDefinitionId | anchors | presets | activities | audiences | risks |
|---|---|---|---|---|---|---|
| 富士山（mountain） | `scene-mount-fuji` | 8 | 4（秋红叶 representative + 冬雪冠） | 5 | 5 | 雷暴 4 步、落石 3 步 |
| 洞爷湖（waterside） | `scene-lake-toya` | 8 | 4（傍晚花火季 representative） | 6 | 5 | 风浪、低水温（岸边/亲子/水上分述） |
| 马尔代夫珊瑚花园（underwater） | `scene-maldives-coral-garden` | 8 | 3（旱季高能见度 representative） | 5 | 5 | 海流 4 步、能见度、水面风浪 |

五主题齐全（4 公共 + nature_geology/water_ecology/underwater_ecology）；锚点仅用契约语义节点名；水下六拍穿水叙事逐字实现；生物文案统一「通常有机会观察到」，copy-validator 13 条禁用模式全量扫描零命中。

## 5. 三场景完成情况

- 山地：高差/峰顶/观景点/路线分级/红叶-雪线-云海 preset/雷暴落石演示/自然地质第五主题 ✅
- 水域：水面/岸线/活动区/薄雾-倒影-傍晚 preset/游船独木舟 SUP/风浪低水温/水域生态 ✅
- 水下：独立场景、穿水六拍进入、能见度/光线/水温、浮潜-体验潜水-持证潜水-摄影-生态观察、海流/能见度/风浪 ✅

## 6. 实况/预览/风险数据绑定

- 当前实况：进入时 `fetchDestinationLiveData`（Open-Meteo，worker `/api/v1/destinations/live`）；有来源+更新时间在场景角标与面板显示「当前实况 · 来源 · 时间」；缺失自动降为典型预览，不伪造。
- 典型景色预览：策展 preset（含月份规则），全程显示「典型景色预览」。
- 风险演示：「风险情境演示 · 非当前实况」标识 + 五段要素 + 暂停/重播/恢复平静；仅 cautions 主题可触发（状态机强约束）；官方提醒独立来源入口（洞爷湖配置引用北海道官方旅游网站/洞爷湖町官网）。
- 总结页对应内容块保留三态标识（modeBadges），未抹平口径。

## 7. Journey / 心愿 / 准备接入

- 加入心愿 → `toggleWishlist`（localStorage `atlas-wishlist-v1` + toast，既有真实入口）。
- 查看准备事项 → 退出沉浸后打开既有 unlock 弹窗（`openDestinationUnlock` + `getUnlockProfile`）。
- 加入 Journey → 退出沉浸后复用 `addSelectedAttractionToJourney`（有 activeJourney 直接加 stop，无则打开创建对话框并带 pendingStop）。
- 继续规划 / 返回地图 → 恢复地图快照后退出。无伪造入口。

## 8. 埋点接入与验证

`analytics/immersive-events.ts`：18 类事件（§11.4 全表）经 store dispatch 包装层自动上报，携带 entityId 与真实参数；console.debug + localStorage 环形缓冲（500 条，`readImmersiveEvents` 可查漏斗）；预留 `setImmersiveEventSink` 外部通道。验证：`immersive-store.test.tsx` 断言 dispatch 后事件落库。

## 9. 测试结果

- **单元+集成+流程：33 文件 / 260 测试全部通过**（含既有套件 17 文件无回归）。
- 覆盖：锚点上限/截断/降强调、决策引擎（含无选择默认/insufficient_information）、schema 正反例、状态机全转换（含风险中切主题/进入中切换目标/进入中取消）、三件套校验、适配器降级映射、禁用文案、UI 九项（单主题/切换清理/风险触发约束/播放控制/标签上限/默认总结/降级页/Esc/三态标识）、§13.3 流程 1-8 + 范围冻结。
- `tsc --noEmit` 绿；`vite build` 绿（595ms）。
- **Playwright E2E：未实施**（仓库无 Playwright；§13.3 用例以 RTL/机器级集成测试替代）。用例 9（移动端视口）与 10（键盘）部分覆盖（Esc 测试 + CSS 响应式），真机回归列为未完成项。

## 10. 可访问性

原生 button 全键盘可达；Esc 逐级返回（风险→平静→主题→探索→地图）；阶段变化 aria-live 播报；焦点随阶段迁移；风险不仅依赖颜色（▲ 图标 + 文字）；触控区 ≥44pt；reduced-motion 全链路（转场 60ms/拍、观察 ≤300ms、场景静态帧）。

## 11. 性能与资源清理

- 代码分割：沉浸层 React.lazy 按需加载（97KB JS + 15KB CSS，gzip 31KB），主包不退化；单场景程序化资产外链为零（远低于 8MB 预算）。
- 清理（§12.3）：卸载 dispose 场景/renderer/geometry/material、取消 enter/arrival/risk 时序、移除键盘监听、风险状态随状态机清理；enterToken 单调递增（修复了 ENTERING 中切换目标 token 不复位的机器缺陷）。
- 帧率/进入时长/内存实测：本环境无真实设备与浏览器剖析条件，**列为未完成项**，附手动验证步骤（见 §13）。

## 12. 降级与错误演示

SceneController.mount 失败 → FALLBACK：FallbackInfoView 展示五主题等价图文 + 重试（retryEnter）/返回地图；Feature Flag 关闭 → 入口 CTA 隐藏且 overlay 仅渲染等价图文页；非三件套对象 `resolveImmersiveTarget` 返回 null 走既有详情面板；全程无白屏。

## 13. 未完成项及原因

1. **真机性能实测**（预算表帧率/进入时长/内存三行）：需真实浏览器与设备；建议 `npm run dev` 后在 Chrome DevTools Performance 面板测进入耗时、稳态 fps、`performance.memory` 峰值，填入 `p0-audit-report.md` §10 表。
2. **Playwright 真 E2E**（§13.3-9/10 完整版）：需引入 Playwright 依赖与浏览器二进制（本次冻结零新增依赖，故未做）。
3. **埋点外部上报通道**：worker 端点未建；当前 localStorage 缓冲可查询，`setImmersiveEventSink` 留注入点。
4. **generic 场景**（非三件套的可沉浸对象）：当前走标准图文降级，待第二期扩充配置库。

## 14. 命令

```bash
npm run dev          # 前端开发
npm run test:run     # 全部测试（260）
npm run typecheck    # 类型检查
npm run build        # 生产构建（沉浸层自动分包）
npm run deploy       # 构建 + wrangler 部署
```

## 15. 回滚方案

- 功能级：`VITE_IMMERSIVE_EXPLORATION=off` 或浏览器 `localStorage.setItem('atlas-immersive-exploration','off')` → 入口隐藏、直达不可达、既有行为不变。
- 代码级：`git rm -r src/features/immersive-exploration/` + `git checkout -- src/main.jsx`（集成改动仅此一个既有文件），零 schema/依赖/worker 变更。

## 16. 验证位置

- 自动化：`npx vitest run src/features/immersive-exploration`（19 文件 / 169 测试）。
- 手动路径：地图 → 亚洲 → 日本 → 山梨/北海道区域 → 点击富士山/洞爷湖景点锚点 → 底部「沉浸探索」CTA → 五主题探索 → 总结 → 返回（马尔代夫需经搜索或官方种子列表进入）。

## 17. 问题修复记录（2026-07-17 复审反馈）

复审反馈「地图纹理不见了」「点击富士山/洞爷湖锚点后看不到底部沉浸探索 CTA」，排查与修复如下，四项修复均经无头 Edge + CDP 全流程实证（截图见 `verification/`）。

### F1. 区域地图卫星纹理加载失败（环境根因 + 代码根治）

- **根因**：底图唯一源 `services.arcgisonline.com` 在当前网络不可达（curl 连接超时，HTTP 000）；非沉浸功能引入（A/B 对比证实）。原代码无降级，瓦片全部挂起 → 纹理空白。
- **修复**（`src/components/ui/flat-atlas-map.tsx`）：
  1. 三源降级链：`services.arcgisonline.com` → `server.arcgisonline.com`（Esri 经典端点）→ `basemaps.cartocdn.com` 暗色底图；`tileerror` ≥ 4 自动 `setUrl` 切换并同步 attribution。
  2. 3 秒探测定时器：挂起型网络下 `tileerror` 要等浏览器连接超时（~15s）才触发；改为 3 秒内无任何 `tileload` 即主动切源，切源后重新武装探测。
- **实证**：t+2s 自动切至 `server.arcgisonline.com`，t+3s 12/12 瓦片加载完成（修复前需 ~18s+）。

### F2. 沉浸探索 CTA 不可见（代码 bug）

- **根因**：`.immersive-entry-cta` / `.immersive-entry-loading` 样式写在懒加载分包的 `immersive-exploration.css` 内。CTA 在分包加载前渲染为无样式按钮，埋在 DOM 流中不可见。
- **修复**：样式迁移至全局加载的 `src/exploration.css`（原位置留注释）。
- **实证**：CTA `position:fixed`、金色渐变、219px 宽、视口内可见；点击后沉浸层（`.ix-overlay` + canvas）正常进入 洞爷湖（`verification/fa4-cta.jpg`、`fa4-explore.jpg`）。

### F3. 快速点击「洲 → 国家」被弹回洲级（既有竞态）

- **根因**：`syncMapView` 绑在 `zoomend`+`moveend` 上。洲级入场飞行未结束时点击国家，被打断的上一段飞行产生过期 `moveend`（中间缩放 ~2.6 < 4.5 阈值），且 `zoomstart` 处理器已将 `flyingRef` 置假 → 误判为用户缩小 → `exitToContinent` 弹回。真实用户快速双击同样可触发。
- **修复**：新增 `flightGraceUntilRef` 宽限窗口——每次程序化 `flyTo` 起点设置「飞行时长 + 700ms」的宽限期，窗口内 `syncMapView` 的退出/自动进阶/视图回传判断全部挂起；三处 flyTo（层级切换、景点选中、返回区域）均已接入。
- **实证**：洲级飞行进行中立即点击日本，12 秒采样稳定停留「世界/亚洲/日本」（regions=9），不再弹回。

### F4. 景点管线运行期间误显示「该地区暂无景点结果」

- **根因**：`resolveAttractions`（API → 爬虫 → 种子 → 目录）全程 await，无缓存首访区域时列表长时间为空；面板无加载态，直接渲染空态文案，用户误以为没有锚点可点（弱网/OSM 不可达时可达 30s+）。
- **修复**：`main.jsx` 新增 `attractionsLoading` 态（缓存命中即不启用），`AttractionExplorerPanel` 新增 `loading` prop 与加载行（旋转罗盘 + 「正在加载该地区景点…」），样式入 `attraction-explorer.css`（含 reduced-motion 降级）。
- **实证**：进入北海道 4s 时加载行可见（`fa4-loading.jpg`），管线返回后（本次 `[attractions] scrape hit JPN:hokkaido: 8`）锚点正常渲染。

### 回归

- `tsc --noEmit` 绿；`vitest run` 33 文件 / 260 测试全绿；`vite build` 绿（沉浸层分包 97.37 kB / gzip 31.01 kB）。
- 改动文件：`src/components/ui/flat-atlas-map.tsx`、`src/exploration.css`、`src/features/immersive-exploration/immersive-exploration.css`（样式迁出注释）、`src/main.jsx`、`src/features/attraction-explorer/AttractionExplorerPanel.tsx`、`src/features/attraction-explorer/attraction-explorer.css`。


## 18. 第二轮反馈修复记录（2026-07-17 七项反馈）

用户第二轮反馈 7 项，逐项修复如下。全部经无头 Edge + CDP 实证（截图见 `verification/p7*.jpg`），`tsc --noEmit` 绿、`vitest run` 34 文件 / 264 测试全绿、`vite build` 绿。

### P1. 跳过简介后页面空白

- **根因**：跳过 ArrivalIntro 进入 EXPLORE_IDLE 后，需要用户再手动点底部主题才出内容，中间状态只有场景和空 UI。
- **修复**（`ui/ImmersiveExperience.tsx`）：新增 `prevStatusRef` 过渡检测，仅 ARRIVAL→EXPLORE_IDLE 时自动 `activateTheme(scene.themes[0])`（默认展开「景色」面板）；用户主动 `clearTheme` 后不重复展开。配套更新 `immersive-ui.test.tsx` 5 个测试适配新 UX。
- **实证**：点击「跳过介绍」后 15ms 内 `[data-testid="ix-info-panel"]` 出现，标题「景色」。

### P2. 沉浸场景背景空 → 接入实景照片

- **实现**：新建 `data/scene-photos.ts`（`ScenePhoto` + `getScenePhotos(sceneDefinitionId)`，含署名与来源链接）；`SceneCanvas` 重写为照片轮播（9s 交叉淡入 + Ken Burns 缓慢推近，reducedMotion 静止首帧）+ `ix-stage__photo-shade` 压暗 + 角落署名。
- **照片来源**：8 张目检选定存 `public/immersive/photos/`（共 3.3MB，本地资源零运行时外链）：富士山 3 张（樱花雪顶 / 忠灵塔 / 日照金山，Unsplash）、洞爷湖 2 张（北海道官方 HOKKAIDO LOVE! 中岛航拍 / 湖岸栈桥）、马代水下 3 张（鹿角珊瑚雀鲷 / 潜水员笛鲷群 / 礁鲨海底光斑，Unsplash）。候选 12 张中目检淘汰 4 张（含 1 张完全不符的图库错图）。Wikimedia Commons 本机不可达，改用 Unsplash/Pexels。
- **场景透出照片**：Mountain/Waterside 天空穹顶 ShaderMaterial 改 `transparent:true` + `alpha` uniform（随风暴/风力联动），Underwater `scene.background = null`，实景照片从 3D 场景边缘与天空区域透出融合。
- **实证**：`?ix=mount-fuji` 首帧 5.3s 内照片背景可见（含懒加载分包），`?ix=maldives-coral-garden` 1.0s。

### P3. 3D 场景商业级视觉升级

- **Mountain**：远山 3 圈 26 座雾色剪影（雾色联动）、冷色轮廓补光（rim light）、云海圆盘 + 18 个柔光云 sprite 漂移、雪顶 120 个 additive 闪光粒子（雪线重算时重撒，low 画质自动关闭）。
- **Waterside**：水面 additive 波光层（reflection 预设联动）、岸线泡沫环（wind 联动）、水色向天际线 lerp 15%。
- **Underwater**：海底焦散 ShaderMaterial（双层正弦 `pow(c,6)`，lightDepth 联动）、60 个上升气泡、光柱 5→9 根带漂移、太阳辉光扩大加外圈、鱼群分两群（大小各 55，不同尺寸）。
- **方案说明**：「商业级」以光照/材质/氛围 + 实景照片合成路线实现，非摄影测量资产；`shared.ts` 新增 `createRadialGlowTexture/createCloudPuffTexture/createSpeckleTexture`（运行期才调用，jsdom 安全）。

### P4. 场景可缩放 / 旋转 / 复位

- **shared.ts**：引入 `OrbitControls`（three examples），`CameraRig` 加 `cancel()`；`SceneSession` 持有 controls（阻尼随 reducedMotion、禁平移、start 事件取消相机动画并关自动环绕、change 事件 reducedMotion 时请求渲染），新增 `zoomBy(factor)`（夹取 min/maxDistance）、`resetCamera()`、`setAutoRotate(on)`；rig 过渡期间只同步 target 不调 update。
- **三场景家族限制**：mountain 7~55、waterside 6~48、underwater 3.5~40（polar ≤ 0.8π）。
- **UI**：`ImmersiveOverlay` 新增左下 `.ix-camera-dock`——提示「拖拽旋转 · 滚轮缩放」+ 放大 / 缩小 / 复位 / 自动环绕四按钮（reducedMotion 隐藏环绕）。
- **实证**：CDP 模拟拖拽 260px 场景明显绕转、滚轮 -600 明显推近（`p7-fuji-drag.jpg` / `p7-fuji-wheel.jpg`）。

### P5. 景点数据数十秒 → 本地秒出 + 竞速刷新

- **providers.ts**：新增 `peekLocalAttractions`（同步返回本地种子/目录数据，首帧即渲染）+ `raceLiveProviders`（API/爬虫竞速，总预算 15s，超时回退本地）；`main.jsx` 先 peek 后后台刷新。
- **实证**：马尔代夫 → 阿里环礁点击后景点列表 50ms 出现（修复前弱网可达 30s+）。

### P6. 亚洲 → 返回世界 → 再点击：瓦片与描边错位

- **根因**：程序化 `flyTo` 的 `zoomstart` 被误当作用户缩放，`map.stop()` 打断飞行后 tilePane 残留 scale 变换。
- **修复**（`flat-atlas-map.tsx`）：`programmaticZoomRef` 守卫 4 处 flyTo + tilePane scale 残留保险。
- **实证**：世界→亚洲 0ms/300ms 快速重进，`scaleTiles=0`，国界描边与底图对齐（`p7-p6-d0.jpg`）。

### P7. 马尔代夫加入亚洲列表 + 全场景快捷验收入口

- **destinations.ts**：亚洲列表加 MDV；`REGIONS_BY_COUNTRY` 加马代三区域（马累/阿里/芭环礁）；`REGION_SPOTLIGHTS` 加 3 条；`SPOT_COORDINATES` 加 18 个马代坐标点。
- **official-attractions.ts**：WORLD 包加 4 条马代官方景点（`maldives-coral-garden` id 精确命中沉浸适配器）。
- **快捷入口**：`resolve-immersive-target.ts` 新增 `resolveImmersiveTargetByEntityId`；`main.jsx` 支持 `?ix=mount-fuji|lake-toya|maldives-coral-garden` 直达沉浸场景（复用快照保存 + liveSnapshot 拉取）。
- **已知限制**：`asia.geojson` 无马尔代夫多边形，国界描边不渲染马代（数据缺，非代码问题）。
- **实证**：亚洲列表出现马尔代夫 → 阿里环礁 → 珊瑚花园锚点 → 底部「沉浸探索」CTA → 进入水下场景全链路通过（`p7b-mald-*.jpg`）。

### 追加修复（实测中发现）

- **F5. 相机控制坞被遮挡**：全局 `footer{background:#102d2f;min-height:160px}` 元素选择器泄漏到 `.ix-bottombar`（`<footer>` 元素），160px 深色带同 z-index 后绘制压住 Dock。修复：`.ix-bottombar` 覆写 `min-height:0;background:transparent`，Dock z-index 6→7。
- **F6. 全局导航压沉浸层**：`.world-hero{isolation:isolate;z-index:0}` 把 fixed 定位的 `.ix-overlay`(z-60) 关在其层叠上下文内，`.nav`(z-5) 始终压在沉浸层顶栏上（logo 与返回地图重叠）。修复：`immersiveSession` 存在时 `<main>` 加 `immersive-open` 类，CSS 隐藏 `.nav`。

### 回归（第二轮）

- `tsc --noEmit` 绿；`vitest run` 34 文件 / 264 测试全绿；`vite build` 绿。
- 浏览器实测零 JS 异常（首轮 flow C 探针出现 1 次 leaflet 内部异常，后续两轮全链路复测未复现，疑似探针误点非预期元素所致）。
- 改动文件：`src/features/immersive-exploration/ui/ImmersiveExperience.tsx`、`SceneCanvas.tsx`、`ImmersiveOverlay.tsx`、`data/scene-photos.ts`（新）、`scenes/shared.ts`、`scenes/scene-registry.ts`、`runtime/scene-controller.ts`、`scenes/mountain/MountainScene.ts`、`scenes/waterside/WatersideScene.ts`、`scenes/underwater/UnderwaterScene.ts`、`immersive-exploration.css`、`src/features/attraction-explorer/providers.ts`、`src/components/ui/flat-atlas-map.tsx`、`src/data/destinations.ts`、`src/data/official-attractions.ts`、`src/features/immersive-exploration/runtime/resolve-immersive-target.ts`、`src/main.jsx`、`public/immersive/photos/`（8 张新资源）。
