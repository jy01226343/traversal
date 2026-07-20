// 富士山场景最终验证：进入 → 默认机位 → 俯视湖面检查 → 旋转
// 一体化脚本：导航带状态校验，通过地图标记像素点击选中富士山，再点 CTA 进入
import { writeFileSync } from "node:fs"

const OUT = "C:/Users/Administrator/AppData/Local/Temp"
const sleep = ms => new Promise(r => setTimeout(r, ms))

const list = await (await fetch("http://127.0.0.1:9377/json/list")).json()
const page = list.find(t => t.type === "page")
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
const errors = []
ws.onmessage = ev => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result) }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300))
}
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
const evaluate = async expression => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value
const shot = async name => { const { data } = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${OUT}/${name}`, Buffer.from(data, "base64")); console.log("saved", name) }
const hasText = t => evaluate(`document.body.innerText.includes(${JSON.stringify(t)})`)
const clickBtn = t => evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(e => e.textContent.includes(${JSON.stringify(t)})); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return 1 } return 0 })()`)
const step = async (clickText, waitText) => {
  for (let i = 0; i < 10; i += 1) {
    if (await hasText(waitText)) return 1
    await clickBtn(clickText)
    await sleep(1500)
    if (await hasText(waitText)) return 1
  }
  return 0
}
const clickAt = async (x, y) => {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 })
}
const drag = async (x0, y0, dx, dy, steps = 12) => {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y: y0, button: "left", clickCount: 1 })
  for (let i = 1; i <= steps; i += 1) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + (dx * i) / steps, y: y0 + (dy * i) / steps, button: "left" }); await sleep(40) }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x0 + dx, y: y0 + dy, button: "left", clickCount: 1 })
}

await send("Page.enable")
await send("Runtime.enable")
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 950, deviceScaleFactor: 1, mobile: false })
await send("Page.navigate", { url: "http://localhost:5317/" })
await sleep(7000)
console.log("step1:", await step("从亚洲开始探索", "日本"))
console.log("step2:", await step("日本", "中部地方"))
console.log("step3:", await step("中部地方", "景点探索"))

// step4: 用地图容器内“富士山”标记的屏幕坐标点击（Leaflet divIcon DOM 或 canvas 就近命中）
let step4 = 0
for (let attempt = 0; attempt < 10 && !step4; attempt += 1) {
  const pos = await evaluate(`(() => {
    // 优先：DOM 标记（divIcon）
    const dom = [...document.querySelectorAll('.leaflet-marker-icon, [class*=marker]')].find(e => (e.textContent || '').includes('富士'))
    if (dom) { const r = dom.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), via: 'dom' } }
    return null
  })()`)
  if (pos) {
    await clickAt(pos.x, pos.y)
  } else {
    // 回退：canvas 就近命中需要地图点击——用已知锚点附近的试探网格
    const probes = [[880, 501], [870, 490], [890, 512], [860, 520], [900, 495]]
    const p = probes[attempt % probes.length]
    await clickAt(p[0], p[1])
  }
  await sleep(1800)
  step4 = await evaluate(`(() => { const el = document.querySelector('.immersive-entry-cta'); return el ? 1 : 0 })()`)
  if (step4) { console.log("step4 via", pos ? "dom-marker" : "probe", "attempt", attempt); break }
}
console.log("step4:", step4)

// step5: 点击 CTA 进入沉浸场景
let step5 = 0
if (step4) {
  step5 = await evaluate(`(() => { const el = document.querySelector('.immersive-entry-cta'); if (!el) return 0; el.click(); return 1 })()`)
}
console.log("step5:", step5)
await sleep(14000)
await shot("fuji-1-default.png")

// 湖面检查：切到 audience（适合谁）主题机位——朝向河口湖/精进湖方向的低空展望视角
console.log("theme audience:", await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '适合谁'); if (b) { b.click(); return 1 } return 0 })()`))
await sleep(6000)
await shot("fuji-2-lake-down.png")

// 回到景色主题并旋转视角
console.log("theme highlights:", await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === '景色'); if (b) { b.click(); return 1 } return 0 })()`))
await sleep(6000)
await drag(700, 450, 300, -60)
await sleep(2000)
await shot("fuji-3-rotated.png")

console.log("console errors:", errors.slice(0, 5).join(" | ") || "none")
ws.close()
console.log("done")
