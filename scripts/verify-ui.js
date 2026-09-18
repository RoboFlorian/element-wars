const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const PORT = 8765;
const DEBUG_PORT = 9333;
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].find((file) => fs.existsSync(file));

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = "/index.html";
      const file = path.join(ROOT, pathname);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": contentType(file) });
      res.end(fs.readFileSync(file));
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

function waitFor(url, tries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      http.get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve(body));
      }).on("error", () => {
        if (left <= 0) reject(new Error(`timeout waiting for ${url}`));
        else setTimeout(() => attempt(left - 1), 150);
      });
    };
    attempt(tries);
  });
}

function cdpSend(ws, id, method, params) {
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const msg = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
      if (msg.id !== id) return;
      ws.removeEventListener("message", onMessage);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  if (!CHROME) throw new Error("no chrome/edge");
  const server = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pink2048-"));
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ], { stdio: "ignore" });

  try {
    await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const list = JSON.parse(await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/list`));
    const page = list.find((item) => item.type === "page") || list[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });

    await cdpSend(ws, 1, "Page.enable");
    await cdpSend(ws, 2, "Runtime.enable");
    await cdpSend(ws, 21, "Emulation.setDeviceMetricsOverride", {
      width: 430,
      height: 920,
      deviceScaleFactor: 2,
      mobile: true
    });
    const loaded = new Promise((resolve) => {
      const onMessage = (raw) => {
        const msg = JSON.parse(typeof raw.data === "string" ? raw.data : raw.data.toString());
        if (msg.method === "Page.loadEventFired") {
          ws.removeEventListener("message", onMessage);
          resolve();
        }
      };
      ws.addEventListener("message", onMessage);
    });
    await cdpSend(ws, 3, "Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });
    await Promise.race([
      loaded,
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (process.argv.includes("--shots")) {
      await cdpSend(ws, 41, "Runtime.evaluate", {
        expression: "App.show('game', { fresh: true, skipTutorial: true })"
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      const image = await cdpSend(ws, 42, "Page.captureScreenshot", { format: "png" });
      const out = path.join(ROOT, "scripts", "shot-game.png");
      fs.writeFileSync(out, Buffer.from(image.data, "base64"));
      console.log("wrote", out);
    }

    if (process.argv.includes("--palette")) {
      await cdpSend(ws, 41, "Runtime.evaluate", {
        expression: `(() => {
          App.show("game", { fresh: true });
          GameScene.tiles.forEach((tile) => tile.el && tile.el.remove());
          GameScene.tiles = [2,4,8,16,32,64,128,256].map((value, i) => ({
            id: i + 1,
            row: Math.floor(i / 4),
            col: i % 4,
            value,
            el: null,
            removed: false
          }));
          GameScene.draw(false);
        })()`
      });
      await new Promise((resolve) => setTimeout(resolve, 250));
      const image = await cdpSend(ws, 42, "Page.captureScreenshot", { format: "png" });
      const out = path.join(ROOT, "scripts", "shot-palette.png");
      fs.writeFileSync(out, Buffer.from(image.data, "base64"));
      console.log("wrote", out);
    }

    const result = await cdpSend(ws, 5, "Runtime.evaluate", {
      expression: "window.runPink2048E2E()",
      awaitPromise: true,
      returnByValue: true
    });
    const text = result.result.value;
    console.log(text);
    const needed = ["menu-ok", "tutorial-ok", "spotlight-ok", "tutorial-nodmg-ok", "tutorial-skip-ok", "tutorial-reset-ok", "tutorial-once-ok", "game-ok", "lock-ok", "monster-ok", "aim-ok", "launch-ok", "action-ok", "element-color-ok", "board-rim-ok", "monster-el-ok", "dir-element-ok", "upgrade-ok", "cards-ok", "upgrade-back-ok", "carry-ok", "result-ok", "continue-ok", "back-ok"];
    const missing = needed.filter((item) => !text.includes(item));
    if (missing.length) {
      throw new Error(`ui check failed: ${missing.join(", ")} / ${text}`);
    }
    console.log("ui flow passed");
    ws.close();
  } finally {
    chrome.kill();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
