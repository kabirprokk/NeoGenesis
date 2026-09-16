// drive.mjs — my hands and eyes inside NeoGenesis.
// Usage: node drive.mjs <steps...>   (server must run on :5173)
// Mini-language: enter | wait:MS | snap:NAME | w:MS a:MS s:MS d:MS |
//   space | key:CODE (KeyX, KeyB, Backquote, KeyM...) | errors
// Screenshots → dev-play/shots/*.png (read them to SEE the game).
// Console errors + page errors print at the end (or with `errors`).
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(dir, "shots");
fs.mkdirSync(shots, { recursive: true });

const errors = [];
const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--window-size=1280,800"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (m) => { if (m.type() === "error") errors.push("[console] " + m.text()); });
page.on("pageerror", (e) => errors.push("[page] " + String(e && e.message || e)));

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

for (const step of process.argv.slice(2)) {
  if (step === "enter") {
    await page.getByRole("button", { name: /enter the plane/i }).click();
    await page.waitForTimeout(2500);
  } else if (step.startsWith("wait:")) {
    await page.waitForTimeout(parseInt(step.slice(5), 10));
  } else if (step.startsWith("snap:")) {
    await page.screenshot({ path: path.join(shots, step.slice(5) + ".png") });
    console.log("shot:", step.slice(5) + ".png");
  } else if (/^[wasd]:\d+$/.test(step)) {
    const key = step[0].toUpperCase() === "W" ? "KeyW" : step[0].toUpperCase() === "A" ? "KeyA" : step[0].toUpperCase() === "S" ? "KeyS" : "KeyD";
    const ms = parseInt(step.slice(2), 10);
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  } else if (step === "space") {
    await page.keyboard.press("Space");
    await page.waitForTimeout(600);
  } else if (step.startsWith("key:")) {
    await page.keyboard.press(step.slice(4));
    await page.waitForTimeout(800);
  } else if (step === "scan") {
    const found = await page.evaluate(() => {
      const out = [];
      const scene = window.__neoScene;
      if (!scene) return ["no __neoScene"];
      scene.traverse((o) => {
        const g = o.geometry;
        if (g && g.attributes && g.attributes.position && o.type === "Points") {
          const a = g.attributes.position.array;
          out.push(`Points n=${a.length / 3} size=${o.material && o.material.size} cull=${o.frustumCulled} v0=[${a[0]},${a[1]},${a[2]}] v1=[${a[3]},${a[4]},${a[5]}] v2=[${a[6]},${a[7]},${a[8]}]`);
        }
      });
      return out.length ? out : ["clean"];
    });
    console.log("scan:", JSON.stringify(found));
  } else if (step.startsWith("type:")) {
    await page.keyboard.type(step.slice(5));
    await page.waitForTimeout(300);
  } else if (step === "enterkey") {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
  } else if (step.startsWith("neorun:")) {
    await page.getByPlaceholder(/what is the temperature/i).click();
    await page.keyboard.type(step.slice(7));
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);
  } else if (step === "canvas") {
    await page.mouse.click(640, 450);
    await page.waitForTimeout(500);
  } else if (step.startsWith("look:")) {
    const [dx, dy] = step.slice(5).split(",").map(Number);
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(640 + dx, 400 + dy, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500);
  } else if (step.startsWith("burst:")) {
    // Live-play capture: hold W while snapping N frames (flipbook of play).
    const [n, ms, prefix] = step.slice(6).split(",");
    await page.keyboard.down("KeyW");
    for (let i = 0; i < parseInt(n, 10); i++) {
      await page.waitForTimeout(parseInt(ms, 10));
      await page.screenshot({ path: path.join(shots, `${prefix}_${String(i).padStart(2, "0")}.png`) });
    }
    await page.keyboard.up("KeyW");
    console.log(`burst: ${n} frames ${prefix}_*.png`);
  } else if (step === "termtext") {
    const t = await page.evaluate(() => {
      const els = [...document.querySelectorAll("div")].filter((d) => d.textContent && d.textContent.includes("NEOGENESIS terminal"));
      if (!els.length) return "terminal closed";
      return els[0].textContent.slice(-600);
    });
    console.log("TERM::" + t);
  } else if (step === "neotext") {
    const t = await page.evaluate(() => {
      const all = [...document.querySelectorAll("div")];
      // Prefer an actual Neo reply line ("Neo — ..."), else the verdict panel.
      const reply = all.find((d) => d.textContent && /^Neo — /.test(d.textContent.trim()));
      if (reply) return "REPLY::" + reply.textContent.slice(-500);
      const hit = all.find((d) => d.textContent && (d.textContent.includes("Neo has learned from") || (d.textContent.includes("brain 64 cells") && d.textContent.includes("you —"))));
      if (!hit) return "neo panel empty";
      return hit.textContent.slice(-600);
    });
    console.log("NEO::" + t);
  } else if (step === "hudpos") {
    const t = await page.evaluate(() => {
      const el = document.querySelector(".hud-top");
      return el ? el.textContent : "no hud";
    });
    console.log("HUD::" + t);
  } else if (step === "jumptrace") {
    await page.keyboard.press("Space");
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(300);
      const t = await page.evaluate(() => document.querySelector(".hud-top")?.textContent);
      console.log(`t+${(i + 1) * 300}ms:`, (t || "").trim().slice(0, 60));
    }
  } else if (step === "errors") {
    console.log(errors.length ? errors.join("\n") : "(no errors)");
  } else {
    console.log("unknown step:", step);
  }
}
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "ERRORS: none");
await browser.close();
