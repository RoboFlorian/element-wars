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
    data = data || {};

    // 祝福：半透明遮罩盖在游戏上，不卸载下层场景
    if (name === "blessing") {
      if (this.current === "blessing" && this.scenes.blessing) {
        this.scenes.blessing.leave();
      } else if (this.current === "game" && this.scenes.game) {
        this.scenes.game.freezeOverlay();
        this.underlay = "game";
      } else if (this.current && this.scenes[this.current]) {
        this.scenes[this.current].leave();
        this.underlay = null;
      }
      this.current = "blessing";
      document.body.classList.add("is-blessing-overlay");
      document.body.classList.add("is-playing");
      document.body.classList.remove("is-menu");
      const scene = this.scenes.blessing;
      scene.el.hidden = false;
      scene.el.classList.remove("is-enter");
      void scene.el.offsetWidth;
      scene.el.classList.add("is-enter");
      window.setTimeout(() => scene.el.classList.remove("is-enter"), 430);
      scene.enter(data);
      return;
    }

    if (this.current === "blessing" && this.scenes.blessing) {
      this.scenes.blessing.leave();
      document.body.classList.remove("is-blessing-overlay");
      if (name === "game" && this.underlay === "game") {
        this.current = "game";
        this.underlay = null;
        document.body.classList.add("is-playing");
        document.body.classList.remove("is-menu");
        this.scenes.game.el.hidden = false;
        this.scenes.game.enter(data);
        return;
      }
      this.underlay = null;
    }

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
    scene.enter(data);
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

  if (TutorialGuide.ENABLED) {
    localStorage.removeItem("elementwar-trial-done");
    App.show("game", { trial: true, forceTrial: true });
    await sleep(150);
    const overlay = document.getElementById("tutorial-overlay");
    log.push(overlay && !overlay.hidden && TutorialGuide.isActive() && GameScene.trial ? "tutorial-ok" : "tutorial-fail");
    log.push(document.getElementById("game-wave")?.textContent === "试玩" ? "trial-wave-ok" : "trial-wave-fail");
    log.push(document.getElementById("tutorial-shade-top")?.style.height ? "spotlight-ok" : "spotlight-fail");
    const hpWhileGuide = GameScene.monsterHp;
    GameScene.hitMonster([{ amount: 8, element: "water" }]);
    log.push(GameScene.monsterHp === hpWhileGuide ? "tutorial-nodmg-ok" : "tutorial-nodmg-fail");
    document.getElementById("tutorial-skip").click();
    await sleep(120);
    log.push(!TutorialGuide.isActive() && overlay.hidden ? "tutorial-skip-ok" : "tutorial-skip-fail");
    log.push(
      !GameScene.trial &&
        GameScene.monsterHp === GameScene.monsterMax &&
        GameScene.monsterHp === 20 &&
        TutorialGuide.isDone()
        ? "tutorial-reset-ok"
        : "tutorial-reset-fail"
    );

    App.show("menu");
    await sleep(40);

    document.getElementById("menu-start").click();
    await sleep(80);
    log.push(visible("gamescene") ? "game-ok" : "game-fail");
    log.push(TutorialGuide.isActive() || GameScene.trial ? "tutorial-once-fail" : "tutorial-once-ok");
  } else {
    document.getElementById("menu-start").click();
    await sleep(80);
    log.push(visible("gamescene") ? "game-ok" : "game-fail");
    log.push(!TutorialGuide.isActive() && !GameScene.trial ? "tutorial-hidden-ok" : "tutorial-hidden-fail");
  }
  log.push(`tiles-${document.querySelectorAll(".tile").length}`);
  log.push(document.querySelectorAll(".cell.is-locked").length === 0 ? "lock-ok" : "lock-fail");
  log.push(document.querySelector("#monster img") ? "monster-ok" : "monster-fail");
  log.push(document.querySelector(".board-rim-top") ? "board-rim-ok" : "board-rim-fail");

  // 开局老虎机：4 个转轮最后停下的元素 = 本轮攻击顺序
  const slotOrder = GameScene.attackCycle.join(",");
  const reelEnds = [...document.querySelectorAll(".slot-reel")].map((reel) => {
    const cells = reel.querySelectorAll(".element-badge");
    return cells[cells.length - 1]?.dataset.element;
  });
  log.push(
    GameScene.rolling && reelEnds.length === 4 && reelEnds.join(",") === slotOrder
      ? "slot-ok"
      : `slot-fail-${reelEnds.join(",")}-${slotOrder}`
  );
  const blockedMoveHp = GameScene.settleLeft;
  GameScene.move("up");
  log.push(GameScene.settleLeft === blockedMoveHp && !GameScene.busy ? "slot-block-ok" : "slot-block-fail");
  for (let i = 0; i < 160 && GameScene.rolling; i += 1) await sleep(50);
  log.push(!GameScene.rolling && !document.querySelector(".slot-overlay") ? "slot-done-ok" : "slot-done-fail");

  // 固定开局摆放，保证下面的「上滑 / 左滑」一定能动
  GameScene.tiles.forEach((tile) => tile.el && tile.el.remove());
  GameScene.tiles = [];
  GameScene.addTileAt(2, 0, 2);
  GameScene.addTileAt(3, 1, 2);
  GameScene.draw(false);

  // 结算会打怪：先把怪血调厚，避免测试中途击杀进入下一波
  GameScene.monsterMax = 100000;
  GameScene.monsterHp = 100000;
  GameScene.updateHud();
  const expectSettle = (element) => {
    const total = GameScene.tiles
      .filter((tile) => !tile.removed)
      .reduce((sum, tile) => sum + tile.value, 0);
    return Stats.rollAttack(
      total,
      element,
      GameScene.monsterElement,
      GameScene.stats || Stats.createPlayer(),
      () => 0.99
    ).damage;
  };

  const hpBeforeMove = GameScene.monsterHp;
  const settleBeforeMove = GameScene.settleLeft;
  GameScene.move("up");
  await sleep(520);
  // 滑动方向不再给方块染色
  const afterUp = GameScene.tiles.filter((tile) => !tile.removed);
  log.push(
    afterUp.length >= 2 && afterUp.every((tile) => !tile.element)
      ? "no-dir-element-ok"
      : "no-dir-element-fail"
  );
  // 未到结算回合：只推进结算倒计时，不打怪
  const moveDealt = hpBeforeMove - GameScene.monsterHp;
  log.push(
    settleBeforeMove > 1 && moveDealt === 0 && GameScene.settleLeft === settleBeforeMove - 1
      ? "no-settle-ok"
      : `no-settle-fail-${settleBeforeMove}-${GameScene.settleLeft}-${moveDealt}`
  );

  GameScene.move("left");
  await sleep(520);
  log.push(`after-move-${document.querySelectorAll(".tile").length}`);

  const target = document.querySelector("#game-tiles .tile:not(.is-vanish)");
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await sleep(40);
  log.push(target.classList.contains("is-aimed") ? "aim-ok" : "aim-fail");
  const actionsBefore = GameScene.actionsLeft;
  const hpBefore = GameScene.monsterHp;
  const countBefore = GameScene.tiles.length;
  // 让这次消除正好落在结算回合
  GameScene.settleLeft = 1;
  const settleElement = GameScene.nextAttackElement();
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await sleep(300);
  const countAfter = GameScene.tiles.length;
  log.push(
    countAfter === countBefore - 1 || (countBefore === 1 && countAfter === 1)
      ? "eliminate-ok"
      : `eliminate-fail-${countBefore}-${countAfter}`
  );
  const dealt = hpBefore - GameScene.monsterHp;
  const expected = expectSettle(settleElement);
  log.push(
    dealt === expected &&
      GameScene.lastAttackElement === settleElement &&
      GameScene.settleLeft === GameScene.SETTLE_ROUNDS
      ? "settle-ok"
      : `settle-fail-${expected}-${dealt}-${GameScene.settleLeft}`
  );
  log.push(GameScene.actionsLeft === actionsBefore - 1 ? "action-ok" : "action-fail");

  // 元素周期：连续 4 次攻击必定水火土风各一次
  GameScene.attackCycle = [];
  const cycleSeen = [];
  for (let i = 0; i < 4; i += 1) {
    GameScene.settleBoard();
    cycleSeen.push(GameScene.lastAttackElement);
  }
  log.push(
    new Set(cycleSeen).size === 4 && cycleSeen.every((el) => Elements.LIST.includes(el))
      ? "cycle-ok"
      : `cycle-fail-${cycleSeen.join(",")}`
  );
  // 方块颜色 = 下一次攻击的元素
  const nextEl = GameScene.nextAttackElement();
  const shownTiles = [...document.querySelectorAll("#game-tiles .tile:not(.is-vanish)")];
  log.push(
    shownTiles.length && shownTiles.every((el) => el.dataset.element === nextEl)
      ? "tile-color-ok"
      : "tile-color-fail"
  );
  const monsterElText = document.getElementById("monster-element").textContent.trim();
  log.push(monsterElText.length === 1 ? "monster-badge-only-ok" : `monster-badge-only-fail-${monsterElText}`);
  log.push(document.getElementById("monster-element") ? "monster-el-ok" : "monster-el-fail");

  const carry = GameScene.tiles
    .filter((tile) => !tile.removed)
    .map((tile) => `${tile.row}:${tile.col}:${tile.value}:${tile.element}`);
  GameScene.takeAttackElement();
  const cycleBeforeWave = GameScene.attackCycle.join(",");
  GameScene.nextWave();
  await sleep(500);
  // 元素周期只跟玩家攻击次数走，换怪物不重置
  log.push(GameScene.attackCycle.join(",") === cycleBeforeWave ? "cycle-keep-ok" : "cycle-keep-fail");
  if (GameScene.BLESSINGS_ENABLED) {
    log.push(visible("blessingscene") && visible("gamescene") ? "blessing-ok" : "blessing-fail");
    log.push(document.querySelectorAll(".blessing-card").length === 3 ? "cards-ok" : "cards-fail");
    document.querySelector(".blessing-card").click();
    await sleep(80);
    log.push(visible("gamescene") && !visible("blessingscene") ? "blessing-back-ok" : "blessing-back-fail");
  } else {
    log.push(
      !visible("blessingscene") &&
        visible("gamescene") &&
        GameScene.wave === 2 &&
        GameScene.monsterHp === Monsters.hpFor(2)
        ? "next-wave-ok"
        : "next-wave-fail"
    );
    log.push(!document.getElementById("tab-blessings").hidden ? "blessing-tab-ok" : "blessing-tab-fail");
  }
  if (!GameScene.CURSES_ENABLED) {
    const curseIds = (GameScene.monsterCurses && GameScene.monsterCurses.ids) || [];
    log.push(
      curseIds.length === 0 && document.getElementById("monster-curses").hidden
        ? "no-curse-ok"
        : "no-curse-fail"
    );
  }
  log.push(document.querySelector(".blessing-panel,.upgrade-panel") ? "panel-fail" : "panel-ok");
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
