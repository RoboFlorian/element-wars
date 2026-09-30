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
  // 怪物攻击提示：还差几回合显示文字，下一次行动就出手时显示攻击图标，且高度不跳
  {
    const line = document.getElementById("monster-attack-line");
    const cd = document.getElementById("monster-attack-cd");
    const savedActions = GameScene.actionsLeft;
    GameScene.actionsLeft = 3;
    GameScene.updateAttackHud();
    const waitText = cd.textContent.trim();
    const waitNoIcon = !cd.querySelector(".attack-icon");
    const waitHeight = line.getBoundingClientRect().height;
    GameScene.actionsLeft = 1;
    GameScene.updateAttackHud();
    const soonIcon = Boolean(cd.querySelector(".attack-icon")) && line.classList.contains("is-soon");
    const soonHeight = line.getBoundingClientRect().height;
    GameScene.actionsLeft = savedActions;
    GameScene.updateAttackHud();
    log.push(
      waitText === "3 回合后攻击" && waitNoIcon && soonIcon && !/还剩/.test(line.textContent) && waitHeight === soonHeight
        ? "attack-intent-ok"
        : `attack-intent-fail-${waitText}-${soonIcon}-${waitHeight}-${soonHeight}`
    );
  }
  log.push(document.querySelector(".board-rim-top") ? "board-rim-ok" : "board-rim-fail");
  const boardBox = document.getElementById("game-board").getBoundingClientRect();
  log.push(
    Math.abs(boardBox.width - boardBox.height) <= 1 && boardBox.width > 100 && GameScene.ROWS === GameScene.COLS
      ? "board-square-ok"
      : `board-square-fail-${Math.round(boardBox.width)}x${Math.round(boardBox.height)}-${GameScene.ROWS}x${GameScene.COLS}`
  );

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
  const savedHistory = GameScene.cycleHistory.slice();
  const savedOrder = GameScene.attackCycle.slice();
  const drawn = [];
  for (let i = 0; i < 400; i += 1) {
    GameScene.refillAttackCycle();
    drawn.push(GameScene.attackCycle.slice());
  }
  const tripled = drawn.some((cycle, i) =>
    i >= 2 && cycle.some((el, pos) => drawn[i - 1][pos] === el && drawn[i - 2][pos] === el)
  );
  const firstCounts = new Set(drawn.map((cycle) => cycle[0]));
  GameScene.cycleHistory = savedHistory;
  GameScene.attackCycle = savedOrder;
  log.push(!tripled && firstCounts.size === 4 ? "cycle-norepeat-ok" : "cycle-norepeat-fail");
  const hiddenWhileRolling = document.getElementById("settle-next")?.textContent === "";
  const blockedActions = GameScene.actionsLeft;
  GameScene.move("up");
  log.push(GameScene.actionsLeft === blockedActions && !GameScene.busy ? "slot-block-ok" : "slot-block-fail");
  for (let i = 0; i < 160 && GameScene.rolling; i += 1) await sleep(50);
  log.push(!GameScene.rolling && !document.querySelector(".slot-overlay") ? "slot-done-ok" : "slot-done-fail");
  const settleNextEl = document.getElementById("settle-next");
  const nextBadge = settleNextEl && settleNextEl.querySelector(".element-badge");
  const stageHeight = () => document.getElementById("player-zone-stage").getBoundingClientRect().height;
  const stageHeightShown = stageHeight();
  GameScene.slotHidingNext = true;
  GameScene.updateSettleNext();
  const stageHeightHidden = stageHeight();
  GameScene.slotHidingNext = false;
  GameScene.updateSettleNext();
  log.push(
    nextBadge && Math.abs(stageHeightShown - stageHeightHidden) < 0.5
      ? "stage-fixed-ok"
      : `stage-fixed-fail-${stageHeightHidden}-${stageHeightShown}`
  );
  // 提示行显示「下次合成」会变成的元素 = 周期里的下一个
  log.push(
    hiddenWhileRolling &&
      nextBadge &&
      nextBadge.dataset.element === GameScene.attackCycle[0] &&
      settleNextEl.textContent.includes("下次合成")
      ? "settle-next-ok"
      : "settle-next-fail"
  );

  // 角色 1 级基础数值
  const lv1 = PlayerLevels.LEVELS[1];
  log.push(
    GameScene.playerLevel === 1 &&
      document.getElementById("player-level")?.textContent === "1" &&
      GameScene.playerMax === lv1.maxHp &&
      GameScene.stats.critRate === lv1.critRate &&
      GameScene.stats.critDmg === lv1.critDmg
      ? "player-level-ok"
      : "player-level-fail"
  );

  // 合成规则：同等级就能合成（不看元素），合成后等级 +1
  const mergeOf = (a, b) => {
    const result = GameEngine.move([
      { id: 1, row: 0, col: 0, level: a[0], value: Blocks.valueFor(a[0]), element: a[1] || null },
      { id: 2, row: 0, col: 1, level: b[0], value: Blocks.valueFor(b[0]), element: b[1] || null }
    ], "left");
    return result.tiles.filter((tile) => !tile.removed);
  };
  const samePair = mergeOf([1], [1]);
  const mixedElements = mergeOf([2, "fire"], [2, "water"]);
  const levelGap = mergeOf([1], [2]);
  log.push(
    samePair.length === 1 && samePair[0].level === 2 && samePair[0].value === 4 &&
      mixedElements.length === 1 && mixedElements[0].level === 3 &&
      levelGap.length === 2
      ? "block-merge-ok"
      : "block-merge-fail"
  );
  const spawned = GameScene.tiles.filter((tile) => !tile.removed);
  log.push(
    spawned.length && spawned.every((tile) => tile.level === 1 && !tile.element)
      ? "spawn-lv1-ok"
      : "spawn-lv1-fail"
  );

  const placeTiles = (list) => {
    GameScene.tiles.forEach((tile) => tile.el && tile.el.remove());
    GameScene.tiles = [];
    list.forEach((args) => GameScene.addTileAt(...args));
    GameScene.draw(false);
  };

  // 等级外观：只用图标尺寸 + 右上角数字区分，不加额外颜色
  const tierLevels = [1, 2, 3, 4, 6];
  placeTiles(tierLevels.map((level, i) => [Math.floor(i / 3), i % 3, level]));
  const tierLooks = GameScene.tiles.map((tile) => ({
    tier: tile.el.dataset.tier,
    level: tile.el.querySelector(".tile-level").textContent,
    icon: tile.el.querySelector(".tile-icon").getBoundingClientRect().width,
    fill: getComputedStyle(tile.el.querySelector(".tile-icon svg")).fill,
    badge: getComputedStyle(tile.el.querySelector(".tile-level")).backgroundColor,
    ring: getComputedStyle(tile.el, "::after").content
  }));
  const iconsGrow = tierLooks.every((look, i) => i === 0 || look.icon > tierLooks[i - 1].icon);
  const sameColor = (key) => new Set(tierLooks.map((look) => look[key])).size === 1;
  log.push(
    tierLooks.map((look) => look.tier).join(",") === "1,2,3,4,5" &&
      tierLooks.map((look) => look.level).join(",") === tierLevels.join(",") &&
      iconsGrow && sameColor("fill") && sameColor("badge") &&
      tierLooks.every((look) => look.ring === "none" || look.ring === "normal")
      ? "tier-look-ok"
      : `tier-look-fail-${JSON.stringify(tierLooks)}`
  );

  // 固定开局摆放，保证下面的「上滑 / 左滑」一定能动：两块 1 级 + 一块 3 级
  placeTiles([[2, 0, 1], [3, 1, 1], [3, 2, 3]]);
  const tileEls = [...document.querySelectorAll("#game-tiles .tile")];
  log.push(
    tileEls.length === 3 &&
      tileEls.every((el) => el.querySelector(".tile-icon svg") && /^\d+$/.test(el.querySelector(".tile-level").textContent))
      ? "block-icon-ok"
      : "block-icon-fail"
  );

  // 拖方块打怪：先把怪血调厚，避免测试中途击杀进入下一波；关掉暴击让伤害可预测
  GameScene.monsterMax = 100000;
  GameScene.monsterHp = 100000;
  GameScene.stats.critRate = 0;
  GameScene.updateHud();
  const expectHit = (value, element) =>
    Stats.rollAttack(value, element, GameScene.monsterElement, GameScene.stats, () => 0.99).damage;

  const hpBeforeMove = GameScene.monsterHp;
  const actionsBeforeMove = GameScene.actionsLeft;
  GameScene.move("up");
  await sleep(520);
  // 滑动方向不给方块染色
  const afterUp = GameScene.tiles.filter((tile) => !tile.removed);
  log.push(
    afterUp.length >= 2 && afterUp.every((tile) => !tile.element)
      ? "no-dir-element-ok"
      : "no-dir-element-fail"
  );
  // 滑动：消耗一个行动点，不会自动打怪
  const moveDealt = hpBeforeMove - GameScene.monsterHp;
  log.push(
    moveDealt === 0 && GameScene.actionsLeft === actionsBeforeMove - 1
      ? "swipe-action-ok"
      : `swipe-action-fail-${actionsBeforeMove}-${GameScene.actionsLeft}-${moveDealt}`
  );

  // 左滑让两块 1 级合成：合成出的方块变成周期里的下一个元素，没合成的方块仍不带元素
  const mergeElement = GameScene.nextAttackElement();
  const cycleLenBefore = GameScene.attackCycle.length;
  GameScene.move("left");
  await sleep(520);
  log.push(`after-move-${document.querySelectorAll(".tile").length}`);
  const mergedTile = GameScene.tiles.find((tile) => tile.level === 2);
  const plainTilesOk = GameScene.tiles.filter((tile) => tile.level === 1).every((tile) => !tile.element);
  log.push(
    mergedTile && mergedTile.element === mergeElement && plainTilesOk &&
      GameScene.attackCycle.length === cycleLenBefore - 1
      ? "merge-element-ok"
      : `merge-element-fail-${mergedTile && mergedTile.element}-${mergeElement}`
  );

  // 模拟鼠标拖动：按下方块 → 移到目标 → 松开
  const centerOf = (el) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const pointer = (type, target, point) =>
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: "mouse", button: 0,
      clientX: point.x, clientY: point.y
    }));
  const dragTile = async (tile, to) => {
    const from = centerOf(tile.el);
    pointer("pointerdown", tile.el, from);
    pointer("pointermove", window, { x: from.x + 12, y: from.y - 12 });
    pointer("pointermove", window, to);
    const highlighted = {
      monster: GameScene.monsterEl.classList.contains("is-drop-target"),
      shield: GameScene.playerHpRow.classList.contains("is-drop-target"),
      ghost: Boolean(document.querySelector(".tile-ghost"))
    };
    pointer("pointerup", window, to);
    await sleep(260);
    return highlighted;
  };

  // 拖到怪物身上：按方块数值和元素攻击，不消耗行动点
  const attacker = mergedTile;
  const hpBefore = GameScene.monsterHp;
  const actionsBefore = GameScene.actionsLeft;
  const countBefore = GameScene.tiles.length;
  const expected = expectHit(attacker.value, attacker.element);
  const attackLook = await dragTile(attacker, centerOf(GameScene.monsterEl));
  log.push(
    attackLook.monster && !attackLook.shield && attackLook.ghost &&
      !document.querySelector(".tile-ghost") && !GameScene.monsterEl.classList.contains("is-drop-target")
      ? "drag-highlight-ok"
      : `drag-highlight-fail-${JSON.stringify(attackLook)}`
  );
  const dealt = hpBefore - GameScene.monsterHp;
  log.push(
    GameScene.tiles.length === countBefore - 1 && !GameScene.tiles.includes(attacker) && dealt === expected
      ? "drag-attack-ok"
      : `drag-attack-fail-${expected}-${dealt}-${countBefore}-${GameScene.tiles.length}`
  );

  // 拖到一半松手（没到目标、距离也不够滑动）：什么都不发生
  const stay = GameScene.tiles.find((tile) => tile.el);
  const stayFrom = centerOf(stay.el);
  const countBeforeCancel = GameScene.tiles.length;
  await dragTile(stay, { x: stayFrom.x + 14, y: stayFrom.y });
  log.push(
    GameScene.tiles.length === countBeforeCancel && GameScene.tiles.includes(stay) &&
      !stay.el.classList.contains("is-dragging") && GameScene.actionsLeft === actionsBefore
      ? "drag-cancel-ok"
      : "drag-cancel-fail"
  );

  // 拖到血条上：获得同元素、同数值的护盾
  GameScene.elementShields = [];
  GameScene.addTileAt(3, 3, 2, "fire");
  GameScene.draw(false);
  const guardTile = GameScene.tiles.find((tile) => tile.element === "fire");
  const hpBeforeShield = GameScene.monsterHp;
  const shieldLook = await dragTile(guardTile, centerOf(GameScene.playerHpRow));
  const chip = document.querySelector("#player-guard-list .guard-chip");
  log.push(
    shieldLook.shield &&
      GameScene.elementShields.length === 1 &&
      GameScene.elementShields[0].element === "fire" &&
      GameScene.elementShields[0].amount === guardTile.value &&
      GameScene.monsterHp === hpBeforeShield &&
      chip && chip.dataset.element === "fire" && chip.textContent === String(guardTile.value)
      ? "drag-shield-ok"
      : `drag-shield-fail-${JSON.stringify(GameScene.elementShields)}`
  );
  log.push(GameScene.actionsLeft === actionsBefore ? "eliminate-free-ok" : `eliminate-free-fail-${actionsBefore}-${GameScene.actionsLeft}`);

  // 护盾列表：后加的排在最左边（最先挨打）
  GameScene.addElementShield("water", 4);
  const chipOrder = [...document.querySelectorAll("#player-guard-list .guard-chip")].map((el) => el.dataset.element);
  log.push(chipOrder.join(",") === "water,fire" ? "guard-order-ok" : `guard-order-fail-${chipOrder.join(",")}`);

  // 新方块只在有效滑动后生成：最后一块不能使用；滑不动不刷新；滑动有效才刷一块并消耗行动点
  placeTiles([[0, 1, 1]]);
  GameScene.useTile(GameScene.tiles[0], "monster");
  const lastKept = GameScene.tiles.length === 1;
  const actionsBeforeSwipes = GameScene.actionsLeft;
  GameScene.move("up");
  const invalidSwipeIgnored = GameScene.tiles.length === 1 && GameScene.actionsLeft === actionsBeforeSwipes && !GameScene.busy;
  GameScene.move("left");
  await sleep(520);
  log.push(
    lastKept &&
      invalidSwipeIgnored &&
      GameScene.tiles.length === 2 &&
      GameScene.actionsLeft === actionsBeforeSwipes - 1
      ? "no-refill-ok"
      : `no-refill-fail-${lastKept}-${invalidSwipeIgnored}-${GameScene.tiles.length}`
  );
  placeTiles([[3, 3, 1], [3, 0, 3]]);

  // 被怪物克制的护盾：每 1 点伤害消耗 2 点护盾，护盾正好挡完、不掉血
  const monsterDmg = GameScene.monsterDamage();
  const weakElement = Elements.LIST.find((el) => Elements.multiplier(GameScene.monsterElement, el) === 2);
  GameScene.elementShields = [];
  GameScene.addElementShield(weakElement, monsterDmg * 2);
  const hpBeforeHit = GameScene.playerHp;
  GameScene.triggerMonsterAttack();
  await sleep(GameScene.WIND_MS + 150);
  log.push(
    GameScene.playerHp === hpBeforeHit && GameScene.elementShields.length === 0
      ? "guard-counter-ok"
      : `guard-counter-fail-${hpBeforeHit}-${GameScene.playerHp}-${JSON.stringify(GameScene.elementShields)}`
  );

  // 护盾不会在怪物攻击后清空，没打碎的部分一直保留
  GameScene.addElementShield(null, monsterDmg + 5);
  GameScene.triggerMonsterAttack();
  await sleep(GameScene.WIND_MS + 150);
  log.push(
    GameScene.elementShields.length === 1 && GameScene.elementShields[0].amount === 5
      ? "guard-persist-ok"
      : `guard-persist-fail-${JSON.stringify(GameScene.elementShields)}`
  );
  GameScene.elementShields = [];
  GameScene.updateGuardHud();

  // 元素周期：连续 4 次合成依次得到周期里的 4 个元素（不管合成前是什么元素），用完后重新抽取
  GameScene.attackCycle = [];
  const cycleOrder = [GameScene.nextAttackElement(), ...GameScene.attackCycle.slice(1)];
  const cycleSeen = [];
  for (let i = 0; i < 4; i += 1) {
    placeTiles([[0, 0, 1, "fire"], [0, 1, 1, "water"]]);
    GameScene.move("left");
    await sleep(520);
    const merged = GameScene.tiles.find((tile) => tile.level === 2);
    cycleSeen.push(merged && merged.element);
  }
  log.push(GameScene.rolling ? "cycle-reroll-ok" : "cycle-reroll-fail");
  // 第 4 次合成后先弹「即将刷新元素顺序」提示，再弹老虎机：提示期间不能操作，但盘面可见
  const notice = document.querySelector(".settle-notice");
  const noticeShown = () => notice && getComputedStyle(notice).display !== "none";
  log.push(
    GameScene.rolling && !document.querySelector(".slot-overlay") && noticeShown() && notice.textContent.includes("即将刷新元素顺序")
      ? "slot-delay-ok"
      : "slot-delay-fail"
  );
  // 提示至少停留 SLOT_DELAY_MS（从合成结算算起，前面已等了约 520ms）才出老虎机
  const noticeAt = performance.now();
  for (let i = 0; i < 100 && !document.querySelector(".slot-overlay"); i += 1) await sleep(50);
  const noticeGap = performance.now() - noticeAt + 520;
  log.push(noticeGap >= GameScene.SLOT_DELAY_MS - 150 ? "notice-gap-ok" : `notice-gap-fail-${Math.round(noticeGap)}`);
  log.push(
    document.querySelector(".slot-overlay") && !noticeShown() ? "slot-notice-swap-ok" : "slot-notice-swap-fail"
  );
  for (let i = 0; i < 160 && GameScene.rolling; i += 1) await sleep(50);
  log.push(
    cycleSeen.join(",") === cycleOrder.join(",") && new Set(cycleSeen).size === 4
      ? "cycle-ok"
      : `cycle-fail-${cycleSeen.join(",")}-${cycleOrder.join(",")}`
  );

  // 方块颜色和图标 = 它自己的元素；没合成过的方块显示宝石图标、不带颜色
  GameScene.addTile(1);
  GameScene.draw(false);
  const shownTiles = GameScene.tiles.filter((tile) => !tile.removed && tile.el);
  const iconOf = (tile) => tile.el.querySelector(".tile-icon").dataset.icon;
  log.push(
    shownTiles.some((tile) => tile.element) &&
      shownTiles.some((tile) => !tile.element) &&
      shownTiles.every((tile) =>
        tile.element
          ? tile.el.dataset.element === tile.element && iconOf(tile) === tile.element
          : !tile.el.dataset.element && iconOf(tile) === "neutral"
      )
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
  const tabBoard = document.getElementById("tab-board");
  const tabBlessings = document.getElementById("tab-blessings");
  const boardTabLocked = tabBoard.disabled && !tabBlessings.disabled;
  GameScene.setTab("blessings");
  const blessingTabLocked = tabBlessings.disabled && !tabBoard.disabled;  GameScene.setTab("board");
  log.push(boardTabLocked && blessingTabLocked && tabBoard.disabled ? "tab-lock-ok" : "tab-lock-fail");
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
