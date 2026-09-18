/**
 * 这是整个游戏的总控台：负责切界面、记最高分、让背景花瓣飘起来。
 * 三个界面各自有一份 JS，这里只负责把它们串起来。
 */
const App = {
  BEST_KEY: "elementwar-best-wave",
  scenes: {},
  current: null,
  best: 1,

  register(name, scene) {
    this.scenes[name] = scene;
  },

  show(name, data) {
    if (this.current && this.scenes[this.current]) {
      this.scenes[this.current].leave();
    }
    this.current = name;
    document.body.classList.toggle("is-playing", name === "game");
    document.body.classList.toggle("is-menu", name === "menu");
    const scene = this.scenes[name];
    scene.el.hidden = false;
    scene.el.classList.remove("is-enter");
    void scene.el.offsetWidth;
    scene.el.classList.add("is-enter");
    window.setTimeout(() => scene.el.classList.remove("is-enter"), 430);
    scene.enter(data || {});
  },

  loadBest() {
    const saved = Number(localStorage.getItem(this.BEST_KEY) || 1);
    this.best = Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 1;
    return this.best;
  },

  saveBest(wave) {
    const value = Math.max(1, Math.floor(Number(wave) || 1));
    if (value > this.best) {
      this.best = value;
      localStorage.setItem(this.BEST_KEY, String(this.best));
    }
    return this.best;
  },

  formatTime(sec) {
    const total = Math.max(0, Math.floor(Number(sec) || 0));
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  },

  spawnPetals() {
    const field = document.getElementById("petal-field");
    if (!field) return;
    field.innerHTML = "";
    for (let i = 0; i < 18; i += 1) {
      const petal = document.createElement("span");
      petal.className = "petal";
      petal.style.left = `${Math.random() * 100}%`;
      petal.style.animationDuration = `${8 + Math.random() * 10}s`;
      petal.style.animationDelay = `${-Math.random() * 12}s`;
      petal.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
      field.appendChild(petal);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  App.loadBest();
  App.show("menu");
});

window.runPink2048E2E = async function runPink2048E2E() {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (id) => !document.getElementById(id).hidden;
  const log = [];

  App.show("menu");
  await sleep(40);
  if (visible("menuscene")) log.push("menu-ok");
  else log.push("menu-fail");

  localStorage.removeItem("elementwar-tutorial-done");
  App.show("game", { fresh: true, forceTutorial: true });
  await sleep(150);
  const overlay = document.getElementById("tutorial-overlay");
  log.push(overlay && !overlay.hidden && TutorialGuide.isActive() ? "tutorial-ok" : "tutorial-fail");
  log.push(document.getElementById("tutorial-shade-top")?.style.height ? "spotlight-ok" : "spotlight-fail");
  const hpWhileGuide = GameScene.monsterHp;
  GameScene.hitMonster(8, "water");
  log.push(GameScene.monsterHp === hpWhileGuide ? "tutorial-nodmg-ok" : "tutorial-nodmg-fail");
  document.getElementById("tutorial-skip").click();
  await sleep(40);
  log.push(!TutorialGuide.isActive() && overlay.hidden ? "tutorial-skip-ok" : "tutorial-skip-fail");
  log.push(GameScene.monsterHp === GameScene.monsterMax && GameScene.monsterHp === 20 ? "tutorial-reset-ok" : "tutorial-reset-fail");

  App.show("menu");
  await sleep(40);

  document.getElementById("menu-start").click();
  await sleep(80);
  log.push(visible("gamescene") ? "game-ok" : "game-fail");
  log.push(TutorialGuide.isActive() ? "tutorial-once-fail" : "tutorial-once-ok");
  log.push(`tiles-${document.querySelectorAll(".tile").length}`);
  log.push(document.querySelectorAll(".cell.is-locked").length === 4 ? "lock-ok" : "lock-fail");
  log.push(document.querySelector("#monster img") ? "monster-ok" : "monster-fail");
  log.push(document.querySelector(".board-rim-top") ? "board-rim-ok" : "board-rim-fail");

  GameScene.move("up");
  await sleep(520);
  const afterUp = GameScene.tiles.filter((tile) => !tile.removed);
  const painted = afterUp.filter((tile) => tile.element);
  const blank = afterUp.filter((tile) => !tile.element);
  log.push(
    painted.length && painted.every((tile) => tile.element === "wind") && blank.length >= 1
      ? "dir-element-ok"
      : "dir-element-fail"
  );

  GameScene.move("left");
  await sleep(520);
  log.push(`after-move-${document.querySelectorAll(".tile").length}`);

  const hpBefore = Number(document.getElementById("monster-hp-text").textContent);
  const target = document.querySelector(".tile");
  const shot = Number(target.querySelector(".tile-value").textContent);
  const attackEl = target.dataset.element;
  const defendEl = GameScene.monsterElement;
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await sleep(40);
  log.push(target.classList.contains("is-aimed") ? "aim-ok" : "aim-fail");
  const actionsBefore = GameScene.actionsLeft;
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await sleep(500);
  const expected = Elements.applyDamage(shot, attackEl, defendEl);
  const hpAfter = Number(document.getElementById("monster-hp-text")?.textContent || "0");
  const okLaunch = GameScene.monsterHp <= 0 || hpAfter === Math.max(0, hpBefore - expected);
  log.push(okLaunch ? "launch-ok" : `launch-fail-${hpBefore}-${expected}-${hpAfter}`);
  log.push(GameScene.actionsLeft === actionsBefore - 1 || GameScene.monsterHp <= 0 ? "action-ok" : "action-fail");
  log.push(document.querySelector(".tile[data-element]") ? "element-color-ok" : "element-color-fail");
  log.push(document.getElementById("monster-element") ? "monster-el-ok" : "monster-el-fail");

  const carry = GameScene.tiles
    .filter((tile) => !tile.removed)
    .map((tile) => `${tile.row}:${tile.col}:${tile.value}:${tile.element}`);
  GameScene.nextWave();
  await sleep(500);
  log.push(visible("upgradescene") ? "upgrade-ok" : "upgrade-fail");
  log.push(document.querySelectorAll(".upgrade-card").length === 3 ? "cards-ok" : "cards-fail");
  document.querySelector(".upgrade-card").click();
  await sleep(80);
  log.push(visible("gamescene") ? "upgrade-back-ok" : "upgrade-back-fail");
  const afterCarry = GameScene.tiles
    .filter((tile) => !tile.removed)
    .map((tile) => `${tile.row}:${tile.col}:${tile.value}:${tile.element}`);
  const kept = carry.length > 0 && carry.every((key) => afterCarry.includes(key));
  log.push(kept ? "carry-ok" : "carry-fail");

  App.show("result", {
    won: true,
    canContinue: true,
    score: GameScene.score,
    best: App.best,
    maxTile: 2048
  });
  await sleep(80);
  log.push(visible("resultscene") ? "result-ok" : "result-fail");
  log.push(document.getElementById("result-title").textContent);

  document.getElementById("result-primary").click();
  await sleep(80);
  log.push(visible("gamescene") ? "continue-ok" : "continue-fail");

  App.show("result", {
    won: false,
    canContinue: false,
    score: 12,
    best: App.best,
    maxTile: 16
  });
  await sleep(40);
  document.getElementById("result-secondary").click();
  await sleep(80);
  log.push(visible("menuscene") ? "back-ok" : "back-fail");

  return log.join("|");
};
