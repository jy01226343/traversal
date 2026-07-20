// 富士山场景 CDP 截图脚本：进入沉浸场景 → 默认机位 / 交互后共 3 张截图
import { writeFileSync } from "node:fs"

const DEBUG_PORT = 9377
const APP_URL = "http://localhost:5317/"
const OUT = "C:/Users/Administrator/AppData/Local/Temp"

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getTarget() {
  for (let i = 0; i < 20; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()
      const page = list.find(t => t.type === "page")
      if (page) return page
    } catch { /* retry */ }
    await sleep(500)
  }
  throw new Error("no page target")
}

const target = await getTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

let seq = 0
const pending = new Map()
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
  }
}
function send(method, params = {}) {
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
  return r.result?.value
}

async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`${OUT}/${name}`, Buffer.from(data, "base64"))
  console.log("saved", name)
}

async function clickText(text, tag = null) {
  const expr = `(() => {
    const visible = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const sels = ${tag ? `['${tag}']` : `['button', 'a', '[role="button"]', 'li', 'span', 'div']`};
    for (const sel of sels) {
      const els = [...document.querySelectorAll(sel)].filter(e => visible(e) && e.textContent && e.textContent.trim().includes(${JSON.stringify(text)}));
      const leaf = els.find(e => ![...e.children].some(c => c.textContent && c.textContent.trim().includes(${JSON.stringify(text)})));
      const el = leaf || els[0];
      if (!el) continue;
      const target = el.closest('button') || el;
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = target.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, info: sel + ' :: ' + el.textContent.trim().slice(0, 24) };
    }
    return null;
  })()`
  const found = await evaluate(expr)
  if (!found) return null
  await sleep(300) // scrollIntoView 后再点
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: found.x, y: found.y, button: "left", clickCount: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: found.x, y: found.y, button: "left", clickCount: 1 })
  return found.info
}

await send("Page.enable")
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 950, deviceScaleFactor: 1, mobile: false })
await send("Page.navigate", { url: APP_URL })
await sleep(7000)

console.log("webgl check:", await evaluate(`(() => { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); })()`))

console.log("step1:", await clickText("从亚洲开始探索"))
await sleep(1500)
console.log("step2:", await clickText("日本"))
await sleep(1500)
console.log("step3:", await clickText("中部地方"))
await sleep(2500)
// 区域页景点列表：点击 data-attraction 中含「富士山」的按钮
console.log("step4:", await evaluate(`(() => {
  const b = [...document.querySelectorAll('button[data-attraction]')].find(e => e.textContent.includes('富士山'));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, info: b.textContent.trim().slice(0, 24) };
})()`).then(async p => {
  if (!p) return null
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 })
  return p.info
}))
await sleep(1500)
console.log("step5:", await evaluate(`(() => { const el = document.querySelector(".immersive-entry-cta"); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`).then(async p => {
  if (!p) return null
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 })
  return "clicked"
}))
await sleep(12000)

console.log("canvas:", await evaluate(`(() => { const c = document.querySelector("canvas"); return c ? c.width + "x" + c.height : "none"; })()`))
await shot("fuji-1-default.png")

// 交互 1：拖拽旋转视角
await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 800, y: 480, button: "left", clickCount: 1 })
for (let i = 1; i <= 12; i += 1) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 800 + i * 22, y: 480 - i * 4, button: "left" })
  await sleep(40)
}
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1064, y: 432, button: "left", clickCount: 1 })
await sleep(2500)
await shot("fuji-2-rotated.png")

// 交互 2：选中「经典徒步」主题 + 点击一个空间标签
console.log("theme:", await clickText("怎么玩"))
await sleep(2500)
await shot("fuji-3-theme.png")

ws.close()
console.log("done")
