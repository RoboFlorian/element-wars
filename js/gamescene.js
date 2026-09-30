/**
 * 游戏界面：上半区是怪物，下半区是正方形战斗盘。
 *
 * 方块都是元素方块，带等级（方块规则见 blocks.js，刷新规律见 blockspawn.js）；新刷出的方块都是 1 级、不带元素。
 * 战斗回合：滑动 / 道具各算 1 个战斗回合（消耗行动点），只在和怪物战斗时发生。
 * - 滑动：同等级的两块合成高一级的方块
 * - 使用：把方块拖到怪物身上 = 按它的数值和元素攻击；拖到血条上 = 获得同元素、同数值的护盾
 *   （护盾叠放与克制规则见 elementshields.js）。使用方块不消耗行动点
 * - 元素：方块只在合成时获得元素。每次有合成的滑动，本次合成出的方块统一变成周期里的下一个元素；
 *   周期为 4 次合成，水火土风各一次，顺序由老虎机抽出
 * 怪物有自己独立的出手倒计时，与玩家同时开始；玩家每过一回合，倒计时减 1。
 */
const GameScene = {
  el: document.getElementById("gamescene"),
  /** 战斗盘为正方形；每局开始时按边长和目标格子尺寸（px）算出 N×N */
  CELL_TARGET: 60,
  MIN_LINES: 3,
  /** 祝福触发开关：false 时击败怪物不发奖励、直接下一波（祝福页签等界面照常保留） */
  BLESSINGS_ENABLED: false,
  /** 诅咒系统总开关：false 时怪物不带诅咒 */
  CURSES_ENABLED: false,
  MOVE_MS: 170,
  WIND_MS: 420,
  playerLevel: 1,
  ATTACK_ICON:
    '<svg class="attack-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2C12 7 9 11.5 4 14.5"/><path d="M17.5 3.5C15.8 9.5 12 15 5.5 19"/><path d="M21 6.5C19 12 15 17.5 9 21"/></svg>',
  tiles: [],
  nextId: 1,
  score: 0,
  wave: 1,
  /** 本轮还没用到的攻击元素（每轮 4 种各一次，顺序随机） */
  attackCycle: [],
  lastAttackElement: null,
  /** 同一元素最多连续几轮出现在同一位置（2 = 不会连续 3 轮） */
  CYCLE_REPEAT_LIMIT: 2,
  /** 最近几轮的完整顺序，用来限制重复；重开游戏也保留，避免每局开头总是同一元素 */
  cycleHistory: [],
  /** 每轮开始的老虎机抽取动画（ms）：第一个转轮转多久、后面每个多转多久、全部停下后停留多久 */
  SLOT_SPIN_MS: 1600,
  SLOT_STAGGER_MS: 500,
  SLOT_HOLD_MS: 1000,
  /** 一轮元素用完后，「即将刷新元素顺序」提示停留多久再弹出老虎机（ms） */
  SLOT_DELAY_MS: 2500,
  /** 提示在老虎机出现前多久开始淡出（ms），让提示与老虎机之间有明显的停顿 */
  SLOT_NOTICE_FADE_MS: 400,
  rolling: false,
  slotHidingNext: false,
  slotEl: null,
  slotTimers: [],
  playerHp: 100,
  playerMax: 100,
  monsterHp: 0,
  monsterMax: 0,
  surviveSec: 0,
  over: false,
  busy: false,
  attacking: false,
  actionsLeft: 0,
  touchStart: null,
  /** 正在拖动的方块：{ tile, id, x, y, ghost, target } */
  drag: null,
  /** 元素护盾，按添加先后排列（最后一个最先挨打），见 elementshields.js */
  elementShields: [],
  timers: [],
  stats: null,
  blessingState: null,
  trial: false,
  activeTab: "board",
  /** 中间区页签顺序：左 → 右 */
  TAB_ORDER: ["blessings", "board", "items"],

  enter(data) {
    this.cacheDom();
    this.bind();
    this.layout();
    if (data.afterBlessing) {
      this.trial = false;
      if (!this.stats) this.stats = PlayerLevels.createStats(this.playerLevel);
      Blessings.ensure(this);
      if (data.fromDefeat) this.restoreBoard();
      if (data.blessingId) Blessings.applyChoice(this, data.blessingId);
      this.syncHpFromStats();
      if (data.fromDefeat) this.spawnMonster();
      this.setTab("board", { animate: false });
      this.draw(false);
      this.updateHud();
      this.startLoops();
      return;
    }
    if (data.resume && this.tiles.length && !this.over && !this.trial) {
      this.setTab("board", { animate: false });
      this.draw(false);
      this.updateHud();
      this.startLoops();
      return;
    }
    // 试玩关：引导关闭时跳过；打开后只在第一次游玩时进入
    this.trial = TutorialGuide.ENABLED && (Boolean(data.trial) || TutorialGuide.shouldStart(data));
    this.newGame();
    if (this.trial) {
      window.setTimeout(() => TutorialGuide.start(), 80);
    }
  },

  leave() {
    if (TutorialGuide.isActive()) TutorialGuide.dismiss(false);
    this.trial = false;
    this.clearSlot();
    this.stopLoops();
    this.unbind();
    this.el.hidden = true;
  },

  /** 打开祝福遮罩时：停手、停计时，但界面保持可见 */
  freezeOverlay() {
    this.stopLoops();
    this.unbind();
  },

  cacheDom() {
    this.board = document.getElementById("game-board");
    this.lowerEl = document.getElementById("game-lower");
    this.grid = document.getElementById("game-grid");
    this.layer = document.getElementById("game-tiles");
    this.monsterEl = document.getElementById("monster");
    this.waveEl = document.getElementById("game-wave");
    this.playerFill = document.getElementById("player-hp-fill");
    this.playerHpText = document.getElementById("player-hp-text");
    this.playerLevelEl = document.getElementById("player-level");
    this.playerGuardEl = document.getElementById("player-guard-list");
    this.monsterFill = document.getElementById("monster-hp-fill");
    this.monsterHpText = document.getElementById("monster-hp-text");
    this.monsterName = document.getElementById("monster-name");
    this.playerHpRow = this.lowerEl.querySelector(".player-hp");
    this.monsterHpRow = this.el.querySelector(".monster-hp");
    this.attackLine = document.getElementById("monster-attack-line");
    this.attackCdEl = document.getElementById("monster-attack-cd");
    this.attackDmgEl = document.getElementById("monster-attack-dmg");
    this.settleNextEl = document.getElementById("settle-next");
    this.settleLineEl = document.getElementById("settle-line");
    this.monsterElementEl = document.getElementById("monster-element");
    this.monsterCursesEl = document.getElementById("monster-curses");
    this.stageEl = document.getElementById("player-zone-stage");
    this.stageTrack = document.getElementById("stage-track");
  },

  bind() {
    this.onKey = (event) => this.handleKey(event);
    this.onResize = () => {
      this.layout();
      this.syncStageTrack(false);
      this.draw(false);
      if (TutorialGuide.isActive()) TutorialGuide.refreshFocus();
    };
    this.onTouchStart = (event) => {
      const point = event.changedTouches[0];
      this.touchStart = { x: point.clientX, y: point.clientY };
    };
    this.onTouchEnd = (event) => this.handleSwipe(event);
    this.ignoreSwipe = false;

    this.onStagePointerDown = (event) => this.handleStagePointerDown(event);
    this.onStagePointerUp = (event) => this.handleStagePointerUp(event);
    this.onStagePointerCancel = () => {
      this.stageTouch = null;
    };

    this.onDragMove = (event) => this.handleDragMove(event);
    this.onDragEnd = (event) => this.handleDragEnd(event);
    this.onDragCancel = () => this.cancelDrag();

    window.addEventListener("keydown", this.onKey);
    window.addEventListener("resize", this.onResize);
    this.board.addEventListener("touchstart", this.onTouchStart, { passive: true });
    this.board.addEventListener("touchend", this.onTouchEnd);

    if (this.stageEl) {
      this.stageEl.addEventListener("pointerdown", this.onStagePointerDown);
      this.stageEl.addEventListener("pointerup", this.onStagePointerUp);
      this.stageEl.addEventListener("pointercancel", this.onStagePointerCancel);
    }

    document.getElementById("game-menu").onclick = () => App.show("menu");
    document.getElementById("game-restart").onclick = () => {
      if (this.trial || TutorialGuide.isActive()) {
        TutorialGuide.finishTrial();
        return;
      }
      this.newGame();
    };

    this.lowerEl.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.onclick = () => this.setTab(btn.dataset.tab, { animate: true });
    });
  },

  unbind() {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("resize", this.onResize);
    if (this.board) {
      this.board.removeEventListener("touchstart", this.onTouchStart);
      this.board.removeEventListener("touchend", this.onTouchEnd);
    }
    this.cancelDrag();
    if (this.stageEl) {
      this.stageEl.removeEventListener("pointerdown", this.onStagePointerDown);
      this.stageEl.removeEventListener("pointerup", this.onStagePointerUp);
      this.stageEl.removeEventListener("pointercancel", this.onStagePointerCancel);
    }
  },

  get ROWS() {
    return GameEngine.ROWS;
  },

  get COLS() {
    return GameEngine.COLS;
  },

  /** 棋盘内部可摆格子的区域（去掉内边距） */
  boardInnerSize() {
    const styles = getComputedStyle(this.board);
    const pad = parseFloat(styles.paddingLeft) || 0;
    const gap = parseFloat(styles.getPropertyValue("--gap")) || 0;
    return {
      pad,
      gap,
      width: Math.max(0, this.board.clientWidth - pad * 2),
      height: Math.max(0, this.board.clientHeight - pad * 2)
    };
  },

  /** 战斗盘保持 1:1：边长取所在区域宽、高中较小的一边 */
  fitBoardSquare() {
    const host = this.board && this.board.parentElement;
    if (!host) return;
    const styles = getComputedStyle(host);
    const width = host.clientWidth - (parseFloat(styles.paddingLeft) || 0) - (parseFloat(styles.paddingRight) || 0);
    const height = host.clientHeight - (parseFloat(styles.paddingTop) || 0) - (parseFloat(styles.paddingBottom) || 0);
    const side = Math.max(0, Math.floor(Math.min(width, height)));
    this.board.style.width = `${side}px`;
    this.board.style.height = `${side}px`;
  },

  /** 按正方形战斗盘的边长决定 N×N 格子数，只在开新局时调用，局中不变 */
  configureGridSize() {
    this.fitBoardSquare();
    const { gap, width, height } = this.boardInnerSize();
    const side = Math.min(width, height);
    const lines = Math.max(this.MIN_LINES, Math.floor((side + gap) / (this.CELL_TARGET + gap)));
    GameEngine.setSize(lines, lines);
  },

  layout() {
    this.fitBoardSquare();
    const { pad, gap, width, height } = this.boardInnerSize();
    const cellW = (width - gap * (this.COLS - 1)) / this.COLS;
    const cellH = (height - gap * (this.ROWS - 1)) / this.ROWS;
    this.pad = pad;
    this.gap = gap;
    this.cellW = cellW;
    this.cellH = cellH;
    this.board.style.setProperty("--cell-w", `${cellW}px`);
    this.board.style.setProperty("--cell-h", `${cellH}px`);
  },

  tabIndex(tab) {
    const idx = this.TAB_ORDER.indexOf(tab);
    return idx >= 0 ? idx : 1;
  },

  syncStageTrack(animate) {
    if (!this.stageTrack) return;
    const index = this.tabIndex(this.activeTab);
    // 轨道宽 300%，每页占 1/3；用百分比位移，避免父级被撑宽后算错像素
    if (!animate) this.stageTrack.style.transition = "none";
    this.stageTrack.style.transform = `translate3d(-${(index * 100) / 3}%, 0, 0)`;
    if (!animate) {
      void this.stageTrack.offsetWidth;
      this.stageTrack.style.transition = "";
    }
  },

  /**
   * 底部页签 / 中间左右滑：祝福 ← 战斗盘 → 道具
   * 在战斗盘棋盘上滑动仍只负责走棋，不翻页。
   */
  setTab(tab, options) {
    const opts = options || {};
    const name = this.TAB_ORDER.includes(tab) ? tab : "board";
    const animate = Boolean(opts.animate);
    this.activeTab = name;
    this.lowerEl.querySelectorAll(".tab-btn").forEach((btn) => {
      const active = btn.dataset.tab === name;
      btn.classList.toggle("is-active", active);
      btn.disabled = active;
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    this.lowerEl.querySelectorAll(".stage-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.panel === name);
    });
    if (name === "blessings") this.refreshOwnedBlessings();
    if (name === "board") this.layout();
    this.syncStageTrack(animate);
    if (name === "board") this.draw(false);
  },

  shiftTab(delta) {
    const next = this.tabIndex(this.activeTab) + delta;
    if (next < 0 || next >= this.TAB_ORDER.length) return;
    this.setTab(this.TAB_ORDER[next], { animate: true });
  },

  handleStagePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const onBoard = Boolean(event.target.closest && event.target.closest("#game-board"));
    this.stageTouch = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      onBoard
    };
  },

  handleStagePointerUp(event) {
    const start = this.stageTouch;
    if (!start || start.id !== event.pointerId) return;
    this.stageTouch = null;
    // 手指在棋盘上起势：交给走棋，不翻页
    if (this.activeTab === "board" && start.onBoard) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
    // 左滑 → 下一页（祝福→战斗盘→道具）；右滑 → 上一页
    this.shiftTab(dx < 0 ? 1 : -1);
  },

  refreshOwnedBlessings() {
    const list = document.getElementById("owned-blessing-list");
    const empty = document.getElementById("panel-blessings-empty");
    if (!list || !empty) return;
    Blessings.ensure(this);
    const owned = (this.blessingState.owned || [])
      .map((id) => Blessings.find(id))
      .filter(Boolean);
    list.innerHTML = "";
    if (!owned.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    owned.forEach((card) => {
      const li = document.createElement("li");
      li.dataset.rarity = card.rarity;
      li.innerHTML = `<i class="rarity-dot" aria-hidden="true"></i><div><strong>${card.name}</strong><span>${card.desc}</span></div>`;
      list.appendChild(li);
    });
  },

  newGame() {
    this.stopLoops();
    this.clearSlot();
    this.tiles = [];
    this.nextId = 1;
    this.score = 0;
    this.wave = 1;
    this.attackCycle = [];
    this.lastAttackElement = null;
    this.playerLevel = PlayerLevels.START_LEVEL;
    this.stats = PlayerLevels.createStats(this.playerLevel);
    this.blessingState = Blessings.createState();
    this.burns = { player: false, monster: false };
    this.shields = [];
    this.elementShields = [];
    this.storedDamage = null;
    this.extraLocked = new Set();
    this.curseFrozen = new Set();
    this.monsterCurses = typeof Curses !== "undefined" ? Curses.emptyState() : null;
    this.minSpawnValue = 2;
    if (typeof GameEngine !== "undefined") {
      GameEngine.extraLocked = this.extraLocked;
      GameEngine.curseFrozen = null;
    }
    this.syncHpFromStats();
    this.surviveSec = 0;
    this.startedAt = Date.now();
    this.over = false;
    this.busy = false;
    this.attacking = false;
    this.cancelDrag();
    this.boardCarry = null;
    this.layer.innerHTML = "";
    this.configureGridSize();
    this.layout();
    this.buildGrid();
    this.startAttackCycle();
    this.spawnMonster();
    for (let i = 0; i < BlockSpawn.START_COUNT; i += 1) this.addRandomTile();
    this.setTab("board", { animate: false });
    this.draw(false);
    this.updateHud();
    this.startLoops();
  },

  syncHpFromStats() {
    if (!this.stats) this.stats = PlayerLevels.createStats(this.playerLevel);
    Blessings.clampFuryMaxHp(this);
    Stats.clampHp(this.stats);
    this.playerMax = this.stats.maxHp;
    this.playerHp = this.stats.hp;
  },

  syncStatsFromHp() {
    if (!this.stats) this.stats = PlayerLevels.createStats(this.playerLevel);
    this.stats.maxHp = this.playerMax;
    this.stats.hp = this.playerHp;
    Blessings.clampFuryMaxHp(this);
    Stats.clampHp(this.stats);
    this.playerMax = this.stats.maxHp;
    this.playerHp = this.stats.hp;
  },

  buildGrid() {
    this.grid.innerHTML = "";
    this.grid.style.gridTemplateColumns = `repeat(${this.COLS}, 1fr)`;
    this.grid.style.gridTemplateRows = `repeat(${this.ROWS}, 1fr)`;
    for (let i = 0; i < this.ROWS * this.COLS; i += 1) {
      const row = Math.floor(i / this.COLS);
      const col = i % this.COLS;
      const cell = document.createElement("div");
      const playable = GameEngine.isPlayable(row, col);
      cell.className = playable ? "cell" : "cell is-locked";
      if (!playable) cell.textContent = "锁";
      this.grid.appendChild(cell);
    }
  },

  refreshLockedCells() {
    if (typeof Curses !== "undefined") Curses.syncEngine(this);
    else if (typeof GameEngine !== "undefined") {
      GameEngine.extraLocked = this.extraLocked || null;
      GameEngine.curseFrozen = this.curseFrozen && this.curseFrozen.size ? this.curseFrozen : null;
    }
    this.buildGrid();
    this.draw(false);
  },

  /** 把封锁/冻结格上的方块挪到空的可玩格 */
  evacuateLockedTiles() {
    const blocked = new Set([
      ...(this.extraLocked ? [...this.extraLocked] : []),
      ...(this.curseFrozen ? [...this.curseFrozen] : [])
    ]);
    if (!blocked.size) return;
    const stuck = this.tiles.filter(
      (tile) => !tile.removed && blocked.has(`${tile.row},${tile.col}`)
    );
    stuck.forEach((tile) => {
      const empties = [];
      for (let row = 0; row < this.ROWS; row += 1) {
        for (let col = 0; col < this.COLS; col += 1) {
          if (GameEngine.isPlayable(row, col) && !this.tileAt(row, col)) {
            empties.push({ row, col });
          }
        }
      }
      if (!empties.length) {
        tile.removed = true;
        if (tile.el) tile.el.remove();
        return;
      }
      const spot = empties[Math.floor(Math.random() * empties.length)];
      tile.row = spot.row;
      tile.col = spot.col;
    });
    this.tiles = this.tiles.filter((tile) => !tile.removed);
  },

  monsterDamage() {
    // 怪物打过来的「最终攻击」；玩家侧再用防御/闪避结算
    let dmg = Monsters.damageFor(this.wave);
    if (typeof Curses !== "undefined") dmg = Curses.modifyMonsterDamage(this, dmg);
    return dmg;
  },

  actionsPerAttack() {
    let actions = Monsters.actionsFor(this.wave);
    if (typeof Curses !== "undefined") actions = Curses.modifyActionsPerAttack(this, actions);
    return actions;
  },

  monsterElement: "water",

  spawnMonster() {
    this.monsterMax = Monsters.hpFor(this.wave);
    this.monsterHp = this.monsterMax;
    this.monsterElement = Elements.random();
    this.clearBurn("monster");
    this.monsterName.textContent = Monsters.nameFor(this.wave);
    this.monsterEl.classList.remove("is-hit", "is-wind", "is-dead");
    if (typeof Curses !== "undefined") {
      const ids = this.CURSES_ENABLED ? Curses.rollForWave(this.wave) : [];
      Curses.applyToMonster(this, ids);
    } else {
      this.monsterCurses = null;
      if (this.curseFrozen) this.curseFrozen.clear();
    }
    this.resetActionCounter();
    this.updateMonsterElement();
    this.updateMonsterCurses();
    Blessings.onMonsterSpawn(this);
  },

  updateMonsterCurses() {
    const el = this.monsterCursesEl || document.getElementById("monster-curses");
    if (!el) return;
    this.monsterCursesEl = el;
    if (typeof Curses === "undefined") {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    const list = Curses.listActive(this);
    if (!list.length) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.innerHTML = list
      .map((item) => {
        const detail = item.detail ? `<small>（${item.detail}）</small>` : "";
        return `<span class="curse-chip" title="${item.desc}">${item.name}${detail}</span>`;
      })
      .join("");
  },

  updateMonsterElement() {
    if (!this.monsterElementEl) return;
    const meta = Elements.meta(this.monsterElement);
    this.monsterElementEl.innerHTML =
      `<span class="element-badge" data-element="${meta.id}" title="${meta.name}属性">${meta.short}</span>`;
    // 怪物属性变了，所有方块的克制箭头也要跟着刷新
    this.paintTiles();
  },

  resetActionCounter() {
    this.actionsLeft = this.actionsPerAttack();
    this.attacking = false;
    this.updateAttackHud();
  },

  registerAction() {
    if (TutorialGuide.blocksCombat()) return;
    if (this.over || this.attacking || this.monsterHp <= 0) return;
    this.tickBurns();
    if (this.over || this.monsterHp <= 0 || this.playerHp <= 0) return;
    this.tickShields();
    this.actionsLeft = Math.max(0, this.actionsLeft - 1);
    this.updateAttackHud();
    if (this.actionsLeft <= 0) this.triggerMonsterAttack();
  },

  /**
   * 护盾层：amount 可抵挡伤害；actionsLeft 为 null 表示无期限（蓄甲），
   * 有数字则每行动减 1，归零后该层消失（金身）。
   */
  addShield(amount, actionsLeft) {
    if (!Array.isArray(this.shields)) this.shields = [];
    const hp = Math.max(0, Math.floor(Number(amount) || 0));
    if (hp <= 0) return null;
    const life =
      actionsLeft == null || actionsLeft === undefined
        ? null
        : Math.max(0, Math.floor(Number(actionsLeft)));
    const layer = { amount: hp, actionsLeft: life };
    this.shields.push(layer);
    return layer;
  },

  shieldTotal() {
    if (!Array.isArray(this.shields)) return 0;
    return this.shields.reduce((sum, layer) => sum + Math.max(0, layer.amount || 0), 0);
  },

  /** 用护盾抵消伤害，返回剩余需扣血的数值 */
  absorbWithShield(damage) {
    let left = Math.max(0, Math.floor(Number(damage) || 0));
    if (!left || !Array.isArray(this.shields) || !this.shields.length) return left;
    for (const layer of this.shields) {
      if (left <= 0) break;
      const take = Math.min(layer.amount, left);
      layer.amount -= take;
      left -= take;
    }
    this.shields = this.shields.filter((layer) => layer.amount > 0);
    return left;
  },

  tickShields() {
    if (!Array.isArray(this.shields) || !this.shields.length) return;
    this.shields.forEach((layer) => {
      if (layer.actionsLeft == null) return;
      layer.actionsLeft -= 1;
    });
    this.shields = this.shields.filter(
      (layer) => layer.amount > 0 && (layer.actionsLeft == null || layer.actionsLeft > 0)
    );
  },

  /**
   * 灼烧（玩家/怪都可获得）：
   * 获得后到「自己下一次攻击」前，每行动一次扣 5 点体力（生命）。
   */
  hasBurn(who) {
    return Boolean(this.burns && this.burns[who]);
  },

  applyBurn(who) {
    if (!this.burns) this.burns = { player: false, monster: false };
    if (who !== "player" && who !== "monster") return;
    this.burns[who] = true;
  },

  clearBurn(who) {
    if (!this.burns) this.burns = { player: false, monster: false };
    if (who !== "player" && who !== "monster") return;
    this.burns[who] = false;
  },

  tickBurns() {
    if (this.over) return;
    if (this.trial || TutorialGuide.isActive()) return;
    const burnDmg = 5;
    if (this.hasBurn("monster") && this.monsterHp > 0) {
      this.score += burnDmg;
      this.monsterHp = Math.max(0, this.monsterHp - burnDmg);
      this.popDamage(burnDmg, this.monsterEl, "fx-shot", 1, `灼烧-${burnDmg}`);
      this.updateHud();
      if (this.monsterHp <= 0) {
        this.nextWave();
        return;
      }
    }
    if (this.hasBurn("player") && this.playerHp > 0) {
      if (!this.stats) this.stats = PlayerLevels.createStats(this.playerLevel);
      this.syncStatsFromHp();
      this.stats.hp = Math.max(0, this.stats.hp - burnDmg);
      this.syncHpFromStats();
      this.popDamage(burnDmg, this.playerHpRow, "fx-shot is-player", 1, `灼烧-${burnDmg}`);
      this.flashHit(this.playerHpRow, "is-struck");
      this.updateHud();
      if (this.playerHp <= 0) this.handlePlayerDown();
    }
  },

  triggerMonsterAttack() {
    if (this.over || this.attacking) return;
    this.attacking = true;
    // 怪出手 = 怪的「下一次攻击」，清除怪身上的灼烧
    this.clearBurn("monster");
    this.monsterEl.classList.add("is-wind");
    const hit = window.setTimeout(() => {
      this.monsterEl.classList.remove("is-wind");
      this.hurtPlayer(this.monsterDamage());
      if (!this.over && this.monsterHp > 0) this.resetActionCounter();
      else this.attacking = false;
    }, this.WIND_MS);
    this.timers.push(hit);
  },

  handleKey(event) {
    const map = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
      a: "left",
      d: "right",
      w: "up",
      s: "down",
      A: "left",
      D: "right",
      W: "up",
      S: "down"
    };
    const dir = map[event.key];
    if (!dir) return;
    event.preventDefault();
    this.move(dir);
  },

  handleSwipe(event) {
    if (this.ignoreSwipe) {
      this.ignoreSwipe = false;
      this.touchStart = null;
      return;
    }
    if (!this.touchStart) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - this.touchStart.x;
    const dy = point.clientY - this.touchStart.y;
    this.touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.move(dx > 0 ? "right" : "left");
    } else {
      this.move(dy > 0 ? "down" : "up");
    }
  },

  move(dir) {
    if (this.activeTab !== "board") return;
    if (this.busy || this.over || this.rolling) return;
    this.cancelDrag();

    this.tiles.forEach((tile) => {
      tile.merged = false;
      tile.isNew = false;
      tile.justMerged = false;
    });

    const result = GameEngine.move(this.tiles, dir);
    if (!result.moved) return;

    // 合成类祝福（跃升 / 引燃 / 蓄甲 / 滋生）按「本次合成会变成的元素」判定
    const swipeElement = this.nextAttackElement();

    result.tiles.forEach((next) => {
      const tile = this.tiles.find((item) => item.id === next.id);
      if (!tile) return;
      // 滑动阶段只改位置；等级等滑完再改
      tile.row = next.row;
      tile.col = next.col;
      tile.removed = next.removed;
      tile.merged = next.merged;
      tile.justMerged = next.justMerged;
      if (next.justMerged) {
        tile.pendingLevel = next.level;
      }
    });

    this.busy = true;
    this.draw(true);
    TutorialGuide.notify("move");

    window.setTimeout(() => {
      this.tiles = this.tiles.filter((tile) => {
        if (!tile.removed) return true;
        if (tile.el) tile.el.remove();
        return false;
      });
      let didMerge = false;
      let mergeCount = 0;
      const mergedTiles = [];
      this.tiles.forEach((tile) => {
        if (tile.pendingLevel != null) {
          didMerge = true;
          mergeCount += 1;
          mergedTiles.push(tile);
          let level = tile.pendingLevel;
          tile.pendingLevel = null;
          // 跃升：风方向合成后有概率再升一级
          if (Blessings.rollWindAscent(this, swipeElement)) {
            level += 1;
          }
          tile.level = level;
          tile.value = Blocks.valueFor(level);
        }
      });
      // 有合成的滑动才切换元素：本次合成出的方块统一变成周期里的下一个元素
      if (mergedTiles.length) {
        const element = this.takeAttackElement();
        mergedTiles.forEach((tile) => {
          tile.element = element;
        });
        this.lastAttackElement = element;
        this.updateSettleNext();
      }
      // 引燃：火方向且本次有合成时，有概率标记下次攻击必上灼烧
      if (didMerge) Blessings.rollFireIgnite(this, swipeElement);
      // 蓄甲：土方向每合成一次 +1 护盾
      if (mergeCount > 0) Blessings.grantEarthArmorShields(this, swipeElement, mergeCount);
      // 滋生：水方向合成时有概率再生成一块
      if (didMerge && Blessings.rollWaterSpawn(this, swipeElement)) {
        this.addRandomTile();
      }
      for (let i = 0; i < BlockSpawn.PER_MOVE; i += 1) this.addRandomTile();
      this.draw(false);
      // 连消的连击：连续有合成的回合才累计
      if (!didMerge) Blessings.resetAttackCombo(this);
      this.endPlayerRound();
      window.setTimeout(() => {
        this.tiles.forEach((tile) => {
          tile.isNew = false;
          tile.justMerged = false;
        });
        this.busy = false;
      }, 280);
    }, this.MOVE_MS);
  },

  /**
   * 一次消耗行动点的操作（滑动 / 道具）结束 = 一个战斗回合：推进怪物的出手倒计时。
   * 消除方块不走这里。道具等新操作在效果生效后调用本方法即可计入回合。
   */
  endPlayerRound() {
    if (this.over || this.monsterHp <= 0) return;
    this.registerAction();
  },

  /** 下一次宝剑合成会变成的元素（老虎机转完之前不显示） */
  updateSettleNext() {
    if (!this.settleNextEl) return;
    if (this.slotHidingNext) {
      this.settleNextEl.innerHTML = "";
      return;
    }
    const meta = Elements.meta(this.nextAttackElement());
    this.settleNextEl.innerHTML =
      `，下次合成 <span class="element-badge" data-element="${meta.id}" title="${meta.name}">${meta.short}</span>`;
  },

  /** 方块拖到血条上：获得同元素、同数值的护盾，一直保留到被打碎 */
  addElementShield(element, amount) {
    ElementShields.add(this.elementShields, element, amount);
    const name = element ? Elements.meta(element).short : "";
    this.popDamage(amount, this.playerHpRow, "fx-shot is-player", 1, `${name}盾+${amount}`);
    this.updateGuardHud();
  },

  /** 护盾列表：左边第一个最先挨打（= 最后加入的），颜色 = 护盾元素，数字 = 剩余数值 */
  updateGuardHud() {
    if (!this.playerGuardEl) return;
    const layers = this.elementShields.slice().reverse();
    if (!layers.length) {
      this.playerGuardEl.innerHTML = `<em class="guard-empty">0</em>`;
      return;
    }
    const format = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
    this.playerGuardEl.innerHTML = layers
      .map((layer) => {
        const meta = layer.element ? Elements.meta(layer.element) : null;
        const attr = meta ? ` data-element="${meta.id}"` : "";
        const title = `${meta ? meta.name : "无"}属性护盾 ${format(layer.amount)}`;
        return `<span class="element-badge guard-chip"${attr} title="${title}">${format(layer.amount)}</span>`;
      })
      .join("");
  },

  /**
   * 合成元素周期：每 4 次宝剑合成里水火土风各出现一次，顺序随机；
   * 但某元素若已连续 CYCLE_REPEAT_LIMIT 轮落在同一位置，本轮不能再落在该位置。
   */
  refillAttackCycle() {
    const limit = this.CYCLE_REPEAT_LIMIT;
    const recent = this.cycleHistory.slice(-limit);
    const blocked = (order) =>
      recent.length >= limit &&
      order.some((el, pos) => recent.every((cycle) => cycle[pos] === el));
    const all = this.permutations(Elements.LIST);
    const allowed = all.filter((order) => !blocked(order));
    const pool = allowed.length ? allowed : all;
    this.attackCycle = pool[Math.floor(Math.random() * pool.length)].slice();
    this.cycleHistory.push(this.attackCycle.slice());
    if (this.cycleHistory.length > limit) this.cycleHistory.shift();
  },

  permutations(list) {
    if (list.length <= 1) return [list.slice()];
    const out = [];
    list.forEach((item, i) => {
      const rest = list.slice(0, i).concat(list.slice(i + 1));
      this.permutations(rest).forEach((tail) => out.push([item, ...tail]));
    });
    return out;
  },

  nextAttackElement() {
    if (!Array.isArray(this.attackCycle) || !this.attackCycle.length) this.refillAttackCycle();
    return this.attackCycle[0];
  },

  takeAttackElement() {
    const element = this.nextAttackElement();
    this.attackCycle.shift();
    if (!this.attackCycle.length) this.queueAttackCycle();
    return element;
  },

  /**
   * 本轮元素用完：立刻弹出「即将刷新元素顺序」提示，停 SLOT_DELAY_MS 后再播放老虎机抽下一轮；
   * 提示期间盘面可见但不能操作。
   */
  queueAttackCycle() {
    this.clearSlot();
    this.rolling = true;
    this.slotHidingNext = true;
    this.updateSettleNext();
    if (this.settleLineEl) this.settleLineEl.classList.add("is-refreshing");
    this.slotTimers.push(
      window.setTimeout(() => {
        if (this.settleLineEl) this.settleLineEl.classList.add("is-refresh-leaving");
      }, this.SLOT_DELAY_MS - this.SLOT_NOTICE_FADE_MS)
    );
    this.slotTimers.push(window.setTimeout(() => this.startAttackCycle(), this.SLOT_DELAY_MS));
  },

  /** 新一轮攻击元素：洗好顺序后播放老虎机动画告诉玩家 */
  startAttackCycle() {
    this.refillAttackCycle();
    this.playCycleSlot(this.attackCycle.slice());
  },

  /** 老虎机（纯展示）：每个转轮按水火土风固定顺序循环滚动，停在本轮已定好的元素上，从左到右依次停下 */
  playCycleSlot(order) {
    this.clearSlot();
    if (!this.board) return;
    this.rolling = true;
    this.slotHidingNext = true;
    this.updateSettleNext();
    this.cancelDrag();

    const overlay = document.createElement("div");
    overlay.className = "slot-overlay";
    const row = document.createElement("div");
    row.className = "slot-row";
    overlay.appendChild(row);

    const badge = (el) => {
      const meta = Elements.meta(el);
      return `<div class="slot-cell"><span class="element-badge" data-element="${meta.id}">${meta.short}</span></div>`;
    };
    const reels = order.map((target, i) => {
      const reel = document.createElement("div");
      reel.className = "slot-reel";
      const strip = document.createElement("div");
      strip.className = "slot-strip";
      const list = Elements.LIST;
      const duration = this.SLOT_SPIN_MS + i * this.SLOT_STAGGER_MS;
      const laps = Math.max(1, Math.floor(duration / 90 / list.length));
      const steps = laps * list.length + list.indexOf(target);
      const symbols = [];
      for (let k = 0; k <= steps; k += 1) symbols.push(list[k % list.length]);
      strip.innerHTML = symbols.map(badge).join("");
      strip.style.transitionDuration = `${duration}ms`;
      reel.appendChild(strip);
      row.appendChild(reel);
      return { reel, strip, steps: symbols.length - 1 };
    });

    this.board.appendChild(overlay);
    this.slotEl = overlay;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        reels.forEach(({ strip, steps }) => {
          strip.style.transform = `translateY(calc(-${steps} * var(--slot-size)))`;
        });
      });
    });

    reels.forEach(({ reel }, i) => {
      this.slotTimers.push(
        window.setTimeout(
          () => reel.classList.add("is-stopped"),
          this.SLOT_SPIN_MS + i * this.SLOT_STAGGER_MS
        )
      );
    });
    const allStopped = this.SLOT_SPIN_MS + (order.length - 1) * this.SLOT_STAGGER_MS;
    this.slotTimers.push(
      window.setTimeout(() => {
        overlay.classList.add("is-leaving");
        this.slotHidingNext = false;
        this.updateSettleNext();
      }, allStopped + this.SLOT_HOLD_MS)
    );
    this.slotTimers.push(
      window.setTimeout(() => this.clearSlot(), allStopped + this.SLOT_HOLD_MS + 220)
    );
  },

  clearSlot() {
    (this.slotTimers || []).forEach((id) => window.clearTimeout(id));
    this.slotTimers = [];
    if (this.slotEl) this.slotEl.remove();
    this.slotEl = null;
    if (this.settleLineEl) this.settleLineEl.classList.remove("is-refreshing", "is-refresh-leaving");
    this.rolling = false;
    if (this.slotHidingNext) {
      this.slotHidingNext = false;
      this.updateSettleNext();
    }
  },

  /**
   * 玩家的一次攻击。
   * @param {{ amount: number, element: string|null }[]} parts 每组按自身元素单独算克制，最后合并成一次伤害
   */
  hitMonster(parts) {
    if (this.over) return;
    if (!this.stats) this.stats = PlayerLevels.createStats(this.playerLevel);
    Blessings.ensure(this);
    // 玩家出手 = 玩家的「下一次攻击」，清除自己身上的灼烧
    this.clearBurn("player");

    // 污染：只要发动攻击就反噬（即使被威慑/封锁挡下）
    if (typeof Curses !== "undefined" && Curses.has(this, "pollution")) {
      Curses.applyPollution(this);
      if (this.over) return;
    }

    const strike = this.rollStrike(parts);
    if (!strike.hit) {
      this.popDamage(0, this.monsterEl, "fx-shot", 1, strike.blockedReason || "无效");
      this.flashHit(this.monsterEl, "is-hit");
      this.updateHud();
      return;
    }

    const chainDouble = Blessings.rollChainDouble(this);
    this.applyMonsterHit(strike, { chainDouble });
    // 回响：攻击含风时追加一次独立攻击（不额外算回合）
    if (
      !this.over &&
      this.monsterHp > 0 &&
      Blessings.shouldWindEcho(this, strike.elements)
    ) {
      const echo = this.rollStrike(parts);
      if (echo.hit) this.applyMonsterHit(echo, {});
    }
    // 迟滞：攻击含土时有概率让敌人等待 +1
    if (
      !this.over &&
      this.monsterHp > 0 &&
      Blessings.rollEarthDelay(this, strike.elements)
    ) {
      this.actionsLeft += 1;
      this.updateAttackHud();
      this.popDamage(0, this.monsterEl, "fx-shot", 1, "迟滞+1");
    }
    // 回春：攻击含水时有概率回血
    if (Blessings.rollWaterHeal(this, strike.elements)) {
      Blessings.applyWaterHeal(this);
      this.popDamage(10, this.playerHpRow, "fx-shot is-player", 1, "回春+10");
      this.updateHud();
    }
  },

  /**
   * 计算一次攻击的伤害（不扣怪血）。被封锁 / 威慑挡下的组不计伤害。
   * typeMult 取伤害占比最大那一组的克制倍率，用于飘字。
   */
  rollStrike(parts) {
    const fury = Blessings.furyDamageMult(this);
    const strike = {
      hit: false,
      damage: 0,
      typeMult: 1,
      isCrit: false,
      elements: [],
      blockedReason: null
    };
    let topDamage = -1;
    parts.forEach(({ amount, element }) => {
      const settlement = Blessings.pickAttackSettlement(this, element, this.monsterElement);
      const gate =
        typeof Curses !== "undefined"
          ? Curses.beforePlayerAttack(this, element, settlement)
          : { blocked: false, reason: null, damageMult: 1 };
      if (gate.blocked) {
        if (!strike.blockedReason) strike.blockedReason = gate.reason;
        return;
      }
      const attackElement = settlement.attackElement;
      const result = Stats.rollAttack(
        amount * fury * (gate.damageMult || 1),
        attackElement,
        this.monsterElement,
        this.stats,
        Math.random,
        attackElement ? { typeMultOverride: settlement.typeMult } : {}
      );
      strike.hit = true;
      strike.damage += result.damage;
      if (result.isCrit) strike.isCrit = true;
      if (result.damage > topDamage) {
        topDamage = result.damage;
        strike.typeMult = result.typeMult;
      }
      settlement.elements.forEach((el) => {
        if (!strike.elements.includes(el)) strike.elements.push(el);
      });
    });
    return strike;
  },

  applyMonsterHit(strike, options = {}) {
    if (this.over || this.monsterHp <= 0) return;
    // 绝处逢生：最终伤害后再加成
    let dealt = Blessings.applyMonsterTakenBonus(this, strike.damage);
    if (options.chainDouble) {
      dealt *= 2;
    }
    const mult = strike.typeMult;
    if (this.trial || TutorialGuide.isActive()) {
      this.popDamage(dealt, this.monsterEl, "fx-shot", mult, "试玩");
      this.flashHit(this.monsterEl, "is-hit");
      return;
    }
    this.score += dealt;
    this.monsterHp = Math.max(0, this.monsterHp - dealt);
    let label = null;
    if (options.chainDouble && strike.isCrit && mult >= 2) label = `-${dealt} 连消·暴击·克制!`;
    else if (options.chainDouble) label = `-${dealt} 连消!`;
    else if (strike.isCrit && mult >= 2) label = `-${dealt} 暴击·克制!`;
    else if (strike.isCrit && mult === 0.5) label = `-${dealt} 暴击·抵抗`;
    else if (strike.isCrit) label = `-${dealt} 暴击!`;
    this.popDamage(dealt, this.monsterEl, "fx-shot", mult, label);
    this.flashHit(this.monsterEl, "is-hit");
    this.flashHit(this.monsterHpRow, "is-struck");
    // 汲取
    const healed = Blessings.applyLeech(this, dealt);
    if (healed > 0) {
      this.popDamage(healed, this.playerHpRow, "fx-shot is-player", 1, `汲取+${healed}`);
    }
    // 引燃：本次攻击给敌人上灼烧
    if (Blessings.consumeGuaranteedBurn(this)) {
      this.applyBurn("monster");
    }
    this.updateHud();
    if (this.monsterHp <= 0) this.nextWave();
  },

  popDamage(amount, target, className, mult, label) {
    const pop = document.createElement("div");
    pop.className = className;
    if (label) pop.textContent = label;
    else if (mult === 3) pop.textContent = `-${amount} 压制!`;
    else if (mult === 2) pop.textContent = `-${amount} 克制!`;
    else if (mult === 0.5) pop.textContent = `-${amount} 抵抗`;
    else pop.textContent = `-${amount}`;
    const box = (target || this.monsterEl).getBoundingClientRect();
    pop.style.left = `${box.left + box.width / 2}px`;
    pop.style.top = `${box.top + box.height / 2}px`;
    pop.style.setProperty("--dx", "0px");
    pop.style.setProperty("--dy", "-56px");
    document.body.appendChild(pop);
    window.setTimeout(() => pop.remove(), 640);
  },

  flashHit(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    window.setTimeout(() => el.classList.remove(className), 500);
  },

  nextWave() {
    this.captureBoard();
    this.monsterEl.classList.add("is-dead");
    this.stopLoops();
    this.playerHp = Math.min(this.playerMax, this.playerHp + 8);
    this.syncStatsFromHp();
    this.wave += 1;
    this.updateHud();
    window.setTimeout(() => {
      if (this.over) return;
      if (this.BLESSINGS_ENABLED) {
        App.show("blessing", { fromDefeat: true, category: "all" });
        return;
      }
      // 不发奖励：盘面原样保留，直接刷下一只怪
      this.boardCarry = null;
      this.spawnMonster();
      this.updateHud();
      this.startLoops();
    }, 420);
  },

  hurtPlayer(amount) {
    if (this.over) return;
    if (!this.stats) this.stats = PlayerLevels.createStats(this.playerLevel);
    this.syncStatsFromHp();
    Blessings.ensure(this);
    if (Blessings.rollLightBody(this)) {
      this.popDamage(0, this.playerHpRow, "fx-shot is-player", 1, "免疫!");
      this.updateHud();
      return;
    }
    const result = Stats.takeHit(amount, this.stats);
    if (result.dodged) {
      this.popDamage(0, this.playerHpRow, "fx-shot is-player", 1, "闪避!");
      this.updateHud();
      return;
    }
    // 蓄伤：若已有存储，先并入本次；若无存储则有概率改存本次、本下不扣血
    let incoming = result.damage;
    const released = Blessings.consumeStoredDamage(this);
    if (released > 0) {
      incoming += released;
      this.popDamage(released, this.playerHpRow, "fx-shot is-player", 1, `蓄伤结算-${released}`);
    } else if (Blessings.tryStoreDamage(this, incoming)) {
      this.popDamage(0, this.playerHpRow, "fx-shot is-player", 1, "蓄伤!");
      this.updateHud();
      return;
    }
    // 元素护盾先挡（最后加入的最先挨打，克制时消耗翻倍），剩下的再交给祝福护盾
    const pierce = ElementShields.absorb(this.elementShields, incoming, this.monsterElement);
    const remain = this.absorbWithShield(Math.ceil(pierce - 1e-9));
    const blocked = incoming - remain;
    let hpLoss = remain;
    // 续命术：致命攻击（扣血后 ≤0）免疫一次
    if (
      hpLoss > 0 &&
      Blessings.tryFatalGuard(this, this.stats.hp, hpLoss)
    ) {
      this.popDamage(0, this.playerHpRow, "fx-shot is-player", 1, "续命!");
      hpLoss = 0;
    }
    if (hpLoss > 0) {
      this.stats.hp = Math.max(0, this.stats.hp - hpLoss);
      this.syncHpFromStats();
    }
    document.body.classList.remove("is-hurt");
    void document.body.offsetWidth;
    document.body.classList.add("is-hurt");
    this.flashHit(this.playerHpRow, "is-struck");
    if (hpLoss <= 0 && blocked <= 0 && remain > 0) {
      // 续命免疫，已弹字
    } else if (blocked > 0 && hpLoss <= 0 && remain === 0) {
      this.popDamage(blocked, this.playerHpRow, "fx-shot is-player", 1, `护盾-${blocked}`);
    } else if (blocked > 0 && hpLoss > 0) {
      this.popDamage(hpLoss, this.playerHpRow, "fx-shot is-player", 1, `-${hpLoss}(盾-${blocked})`);
    } else if (hpLoss > 0) {
      this.popDamage(hpLoss, this.playerHpRow, "fx-shot is-player");
    } else if (blocked > 0) {
      this.popDamage(blocked, this.playerHpRow, "fx-shot is-player", 1, `护盾-${blocked}`);
    }
    // 金身：受到伤害（未闪避/免疫）后立刻生成限时护盾
    Blessings.grantGoldenBodyShield(this);
    // 烙印：挨打后有概率给敌人上灼烧
    if (!this.over && this.monsterHp > 0 && Blessings.rollFireBrand(this)) {
      this.applyBurn("monster");
    }
    window.setTimeout(() => document.body.classList.remove("is-hurt"), 560);
    this.updateHud();
    if (this.playerHp <= 0) this.handlePlayerDown();
  },

  /** 玩家倒下：先尝试「再来一次」，否则结算 */
  handlePlayerDown() {
    if (this.over) return;
    if (Blessings.tryOnceMore(this)) {
      if (!this.stats) this.stats = PlayerLevels.createStats(this.playerLevel);
      this.stats.hp = this.stats.maxHp;
      this.syncHpFromStats();
      this.popDamage(0, this.playerHpRow, "fx-shot is-player", 1, "再来一次!");
      this.updateHud();
      if (this.monsterHp > 0) {
        this.score += this.monsterHp;
        this.monsterHp = 0;
        this.updateHud();
        this.nextWave();
      }
      return;
    }
    this.endRun();
  },

  startLoops() {
    this.stopLoops();
    this.startedAt = Date.now() - this.surviveSec * 1000;
    const tick = window.setInterval(() => {
      this.surviveSec = (Date.now() - this.startedAt) / 1000;
    }, 250);
    this.timers.push(tick);
    if (this.actionsLeft <= 0) this.resetActionCounter();
    else this.updateAttackHud();
  },

  updateAttackHud() {
    if (!this.attackCdEl) return;
    // 怪物视角：下一次行动就会出手时显示攻击图标，否则显示还要几回合
    const imminent = this.actionsLeft <= 1;
    this.attackCdEl.innerHTML = imminent
      ? `${this.ATTACK_ICON}<span>即将攻击</span>`
      : `${this.actionsLeft} 回合后攻击`;
    this.attackDmgEl.textContent = String(this.monsterDamage());
    this.attackLine.classList.toggle("is-soon", imminent);
  },

  stopLoops() {
    this.timers.forEach((id) => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });
    this.timers = [];
    document.body.classList.remove("is-hurt");
    this.attacking = false;
    if (this.monsterEl) this.monsterEl.classList.remove("is-wind");
  },

  endRun() {
    if (this.trial) {
      TutorialGuide.finishTrial();
      return;
    }
    this.over = true;
    this.stopLoops();
    const survived = Math.floor(this.surviveSec);
    const wasBest = this.wave > App.best;
    App.saveBest(this.wave);
    const maxTile = this.tiles.reduce((max, tile) => Math.max(max, tile.value), 0);
    App.show("result", {
      surviveSec: this.surviveSec,
      wave: this.wave,
      score: this.score,
      best: App.best,
      maxTile,
      isRecord: wasBest
    });
  },

  updateHud() {
    this.syncHpFromStats();
    this.waveEl.textContent = this.trial ? "试玩" : String(this.wave);
    this.updateAttackHud();
    this.updateSettleNext();
    this.updateMonsterElement();
    this.playerHpText.textContent = String(this.playerHp);
    if (this.playerLevelEl) this.playerLevelEl.textContent = String(this.playerLevel);
    this.updateGuardHud();
    this.monsterHpText.textContent = String(this.monsterHp);
    this.playerFill.style.transform = `scaleX(${this.playerHp / this.playerMax})`;
    this.monsterFill.style.transform = `scaleX(${this.monsterMax ? this.monsterHp / this.monsterMax : 0})`;
  },

  // ---------- 方块：放上战斗盘（刷在哪、刷什么由 BlockSpawn 决定） ----------

  /** 按刷新规律在随机空格刷一块；没有空格返回 false */
  addRandomTile() {
    return this.addTile();
  },

  /** 在随机空格放一块指定等级的方块（不指定则按刷新规律）；没有空格返回 false */
  addTile(level, element = null) {
    const spot = BlockSpawn.pick(this.tiles, this.ROWS, this.COLS, {
      level,
      isPlayable: (row, col) => GameEngine.isPlayable(row, col)
    });
    if (!spot) return false;
    this.addTileAt(spot.row, spot.col, spot.level, element);
    return true;
  },

  addTileAt(row, col, level = BlockSpawn.LEVEL, element = null) {
    this.tiles.push({
      id: this.nextId++,
      row,
      col,
      level,
      value: Blocks.valueFor(level),
      element,
      el: null,
      merged: false,
      removed: false,
      isNew: true
    });
  },

  tileAt(row, col) {
    return this.tiles.find((tile) => !tile.removed && tile.row === row && tile.col === col);
  },

  // ---------- 方块外观（UI）：当前用代码绘制的 SVG，之后换贴图只需改这一段 ----------

  /** 还没合成过、不带元素的方块 */
  NEUTRAL_ICON:
    '<svg viewBox="0 0 24 24"><path d="M7 3H17L22 9L12 21L2 9Z"/><path class="tile-icon-line" d="M2 9H22M9.5 3 7.5 9 12 21 16.5 9 14.5 3"/></svg>',
  /** 合成过的方块：图标 = 它自己的元素 */
  ELEMENT_ICONS: {
    water:
      '<svg viewBox="0 0 24 24"><path d="M12 2C12 2 5 10.5 5 15A7 7 0 0 0 19 15C19 10.5 12 2 12 2Z"/><path class="tile-icon-line" d="M8.6 15.2A3.4 3.4 0 0 0 11.4 18.6"/></svg>',
    fire:
      '<svg viewBox="0 0 24 24"><path d="M12 1.8C13.2 5.6 18.5 8.2 18.5 14.2A6.5 6.5 0 0 1 5.5 14.2C5.5 10.9 7.3 8.8 8.9 7.4 8.9 9.8 10 11.2 11.3 11.6 10.4 8.4 10.8 4.8 12 1.8Z"/><path class="tile-icon-line" d="M12 13.5C13.6 15 14.2 16.2 14.2 17.4A2.2 2.2 0 0 1 9.8 17.4C9.8 16 10.8 14.8 12 13.5Z"/></svg>',
    earth:
      '<svg viewBox="0 0 24 24"><path d="M1.8 20.5 8.8 6.5 13 13.2 15.6 9.6 22.2 20.5Z"/><path class="tile-icon-line" d="M6.9 10.3 8.8 12 10.7 10.3"/></svg>',
    wind:
      '<svg viewBox="0 0 24 24"><g class="tile-icon-wind"><path d="M3 9H14.5A3 3 0 1 0 11.5 6"/><path d="M3 13.5H18A2.6 2.6 0 1 1 15.4 16.1"/><path d="M3 18H10"/></g><g class="tile-icon-wind is-core"><path d="M3 9H14.5A3 3 0 1 0 11.5 6"/><path d="M3 13.5H18A2.6 2.6 0 1 1 15.4 16.1"/><path d="M3 18H10"/></g></svg>'
  },
  /** 等级外观最多分到第几档（右上角数字 + 图标尺寸），更高等级沿用最后一档 */
  MAX_TIER: 5,

  pos(row, col) {
    return {
      x: col * (this.cellW + this.gap),
      y: row * (this.cellH + this.gap)
    };
  },

  draw(animate) {
    this.tiles.forEach((tile) => {
      if (!tile.el) {
        tile.el = document.createElement("div");
        tile.el.className = "tile";
        tile.el.innerHTML =
          `<span class="tile-advantage" aria-hidden="true"></span>` +
          `<span class="tile-icon" aria-hidden="true"></span>` +
          `<span class="tile-level"></span>`;
        this.layer.appendChild(tile.el);
        this.bindTile(tile);
      }

      const { x, y } = this.pos(tile.row, tile.col);
      this.paintTile(tile);
      // 滑动动画中等级等停稳再刷新
      if (!animate) {
        tile.el.dataset.level = String(tile.level);
        tile.el.dataset.tier = String(Math.min(tile.level, this.MAX_TIER));
        const elementName = tile.element ? `${Elements.meta(tile.element).name}属性` : "无属性";
        tile.el.title = `${tile.level}级${elementName}${Blocks.NAME}（${tile.value}）`;
        const levelEl = tile.el.querySelector(".tile-level");
        if (levelEl) levelEl.textContent = String(tile.level);
      }
      tile.el.style.setProperty("--x", `${x}px`);
      tile.el.style.setProperty("--y", `${y}px`);

      tile.el.classList.toggle("is-spawn", tile.isNew && !animate);
      tile.el.classList.toggle("is-merge", tile.justMerged && !animate);

      if (!animate) {
        tile.el.style.transition = "none";
        void tile.el.offsetWidth;
        tile.el.style.transition = "";
      }
    });
  },

  /**
   * 方块图标与颜色 = 它自己的元素（合成时获得），左上角箭头表示攻击怪物时克制 / 被克制；
   * 没合成过的方块不带元素，显示白底宝石图标。
   */
  paintTile(tile) {
    if (!tile.el) return;
    let mark = tile.el.querySelector(".tile-advantage");
    if (!mark) {
      mark = document.createElement("span");
      mark.className = "tile-advantage";
      mark.setAttribute("aria-hidden", "true");
      tile.el.prepend(mark);
    }
    mark.classList.remove("is-up", "is-down");
    mark.textContent = "";
    const element = tile.element || null;
    const icon = tile.el.querySelector(".tile-icon");
    const iconKey = element || "neutral";
    if (icon && icon.dataset.icon !== iconKey) {
      icon.dataset.icon = iconKey;
      icon.innerHTML = element ? this.ELEMENT_ICONS[element] || "" : this.NEUTRAL_ICON;
    }
    if (!element) {
      delete tile.el.dataset.element;
      return;
    }
    tile.el.dataset.element = element;
    const { typeMult } = Blessings.pickAttackSettlement(this, element, this.monsterElement);
    if (typeMult > 1) {
      mark.classList.add("is-up");
    } else if (typeMult < 1) {
      mark.classList.add("is-down");
    }
  },

  paintTiles() {
    this.tiles.forEach((tile) => this.paintTile(tile));
  },

  // ---------- 方块操作：拖到怪物身上攻击，拖到血条上加护盾 ----------

  /** 手指 / 鼠标移动超过多少像素才算开始拖动 */
  DRAG_START_PX: 8,
  /** 目标区域四周放宽的判定范围（px） */
  DROP_SLOP_PX: 16,

  bindTile(tile) {
    if (!tile.el || tile.el.dataset.bound === "1") return;
    tile.el.dataset.bound = "1";
    tile.el.addEventListener("pointerdown", (event) => this.startDrag(tile, event));
  },

  startDrag(tile, event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (this.activeTab !== "board" || this.busy || this.over || this.rolling || !tile || tile.removed) return;
    event.preventDefault();
    this.cancelDrag();
    this.drag = { tile, id: event.pointerId, x: event.clientX, y: event.clientY, ghost: null, target: null };
    window.addEventListener("pointermove", this.onDragMove);
    window.addEventListener("pointerup", this.onDragEnd);
    window.addEventListener("pointercancel", this.onDragCancel);
  },

  handleDragMove(event) {
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.ghost) {
      if (Math.hypot(dx, dy) < this.DRAG_START_PX || !drag.tile.el) return;
      const rect = drag.tile.el.getBoundingClientRect();
      const ghost = drag.tile.el.cloneNode(true);
      ghost.classList.remove("is-spawn", "is-merge");
      ghost.classList.add("tile-ghost");
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      drag.tile.el.classList.add("is-dragging");
    }
    drag.ghost.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
    this.setDropTarget(this.dropTargetAt(event.clientX, event.clientY));
  },

  /** 松手位置落在哪个目标上：monster = 攻击，shield = 加护盾，null = 都不是 */
  dropTargetAt(x, y) {
    const inside = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const slop = this.DROP_SLOP_PX;
      return x >= rect.left - slop && x <= rect.right + slop && y >= rect.top - slop && y <= rect.bottom + slop;
    };
    if (inside(this.monsterEl)) return "monster";
    if (inside(this.playerHpRow)) return "shield";
    return null;
  },

  setDropTarget(target) {
    if (!this.drag || this.drag.target === target) return;
    this.drag.target = target;
    if (this.monsterEl) this.monsterEl.classList.toggle("is-drop-target", target === "monster");
    if (this.playerHpRow) this.playerHpRow.classList.toggle("is-drop-target", target === "shield");
  },

  /**
   * 松手：落在怪物 / 血条上就使用方块；否则拖动距离够长时当作一次滑动。
   * 触屏时同一次触摸还会触发棋盘的 touchend，用 ignoreSwipe 避免重复滑动。
   */
  handleDragEnd(event) {
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) return;
    if (event.pointerType === "touch") this.ignoreSwipe = true;
    const target = drag.ghost ? this.dropTargetAt(event.clientX, event.clientY) : null;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    this.cancelDrag(Boolean(target));
    if (target) {
      this.useTile(drag.tile, target);
    } else if (Math.max(Math.abs(dx), Math.abs(dy)) >= 28) {
      if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? "right" : "left");
      else this.move(dy > 0 ? "down" : "up");
    }
  },

  /** 结束拖动并清理残影；dropped 为 true 时残影在目标处缩小消失 */
  cancelDrag(dropped = false) {
    const drag = this.drag;
    this.drag = null;
    window.removeEventListener("pointermove", this.onDragMove);
    window.removeEventListener("pointerup", this.onDragEnd);
    window.removeEventListener("pointercancel", this.onDragCancel);
    if (this.monsterEl) this.monsterEl.classList.remove("is-drop-target");
    if (this.playerHpRow) this.playerHpRow.classList.remove("is-drop-target");
    if (!drag) return;
    if (drag.tile.el) drag.tile.el.classList.remove("is-dragging");
    const ghost = drag.ghost;
    if (!ghost) return;
    if (dropped) {
      ghost.classList.add("is-dropped");
      window.setTimeout(() => ghost.remove(), 200);
    } else {
      ghost.remove();
    }
  },

  /**
   * 使用方块：不算行动点（不推进怪物出手倒计时），也不补新方块。
   * 新方块只在有效滑动后生成，所以场上最后一块不能使用，否则会没有可滑动的方块而卡死。
   * - monster：用方块的数值和元素攻击怪物（没合成过的方块不带元素，按无克制计算）
   * - shield：获得同元素、同数值的护盾（叠放规则见 elementshields.js）
   */
  useTile(tile, target) {
    if (this.busy || this.over || this.rolling || !tile || tile.removed || !tile.el) return;
    if (this.tiles.filter((item) => !item.removed).length <= 1) {
      this.popDamage(0, tile.el, "fx-shot", 1, "至少保留 1 块");
      return;
    }

    const info = { level: tile.level, value: tile.value, element: tile.element || null };
    tile.removed = true;
    this.tiles = this.tiles.filter((item) => item !== tile);
    tile.el.remove();

    Blessings.resetAttackCombo(this);
    if (target === "monster") {
      this.hitMonster([{ amount: info.value, element: info.element }]);
    } else if (target === "shield" && !this.over) {
      this.addElementShield(info.element, info.value);
    }
    this.onUseTile(info, target);
    TutorialGuide.notify("eliminate");
    if (TutorialGuide.isActive()) TutorialGuide.refreshFocus();
  },

  /**
   * 使用方块的额外效果（待设计）。
   * @param {{ level: number, value: number, element: string|null }} info 被使用方块的等级、数值与元素
   * @param {"monster"|"shield"} target 拖到了哪里
   */
  onUseTile(info, target) {},

  // ---------- 跨波次保留盘面 ----------

  /** 击败怪物进入下一波前记录盘面，下一波原样恢复 */
  captureBoard() {
    this.boardCarry = this.tiles
      .filter((tile) => !tile.removed)
      .map((tile) => ({
        row: tile.row,
        col: tile.col,
        level: tile.level,
        element: tile.element
      }));
  },

  restoreBoard() {
    const carry = this.boardCarry;
    if (!carry) return;
    this.boardCarry = null;
    this.cancelDrag();
    this.tiles.forEach((tile) => {
      if (tile.el) tile.el.remove();
    });
    this.tiles = [];
    if (this.layer) this.layer.innerHTML = "";
    carry.forEach((tile) => {
      this.addTileAt(tile.row, tile.col, tile.level, tile.element);
    });
    this.tiles.forEach((tile) => {
      tile.isNew = false;
    });
  }
};

App.register("game", GameScene);
