// 调试： dump 页面按钮文本
const sleep = ms => new Promise(r => setTimeout(r, ms))
const list = await (await fetch("http://127.0.0.1:9377/json/list")).json()
const page = list.find(t => t.type === "page")
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result) }
}
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
const evaluate = async expression => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value
console.log("url:", await evaluate("location.href"))
console.log("buttons:", await evaluate(`[...document.querySelectorAll('button')].slice(0,40).map(b => b.textContent.trim().slice(0,20)).join(' | ')`))
console.log("has text:", await evaluate(`document.body.innerText.includes('从亚洲开始探索')`))
console.log("innerText head:", await evaluate(`document.body.innerText.slice(0, 200)`))
ws.close()
