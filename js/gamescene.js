/**
 * 游戏界面：上半区是怪物，下半区是 4×4 的 2048（默认全可玩）。
 *
 * 战斗回合：玩家每完成一次操作（滑动 / 消除 / 道具）= 1 个战斗回合，只在和怪物战斗时发生。
 * - 滑动：数字相同的方块合成更大的方块
 * - 消除：双击移走一个方块
 * - 结算：每隔 SETTLE_ROUNDS 个回合，场上每个方块的数字各算一次，累加后打向怪物
 *   攻击元素按周期轮换：每 4 次攻击里水火土风各出现一次，顺序随机
 * 怪物有自己独立的出手倒计时，与玩家同时开始；玩家每过一回合，倒计时减 1。
 */
const GameScene = {
  el: document.getElementById("gamescene"),
  /** 战斗盘铺满整块区域；每局开始时按区域大小和目标格子尺寸（px）算出行列数 */
  CELL_TARGET: 60,
  MIN_LINES: 3,
  /** 每隔多少个战斗回合结算一次场上方块的伤害 */
  SETTLE_ROUNDS: 3,
  /** 祝福触发开关：false 时击败怪物不发奖励、直接下一波（祝福页签等界面照常保留） */
  BLESSINGS_ENABLED: false,
  /** 诅咒系统总开关：false 时怪物不带诅咒 */
  CURSES_ENABLED: false,
  MOVE_MS: 170,
  PLAYER_MAX: 100,
  WIND_MS: 420,
  tiles: [],
  nextId: 1,
  score: 0,
  wave: 1,
  settleLeft: 0,
  /** 本轮还没用到的攻击元素（每轮 4 种各一次，顺序随机） */
  attackCycle: [],
  lastAttackElement: null,
  /** 每轮开始的老虎机抽取动画（ms）：第一个转轮转多久、后面每个多转多久、全部停下后停留多久 */
  SLOT_SPIN_MS: 1000,
  SLOT_STAGGER_MS: 500,
  SLOT_HOLD_MS: 1000,
  rolling: false,
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
  selected: null,
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
      if (!this.stats) this.stats = Stats.createPlayer();
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
    this.monsterFill = document.getElementById("monster-hp-fill");
    this.monsterHpText = document.getElementById("monster-hp-text");
    this.monsterName = document.getElementById("monster-name");
    this.playerHpRow = this.lowerEl.querySelector(".player-hp");
    this.monsterHpRow = this.el.querySelector(".monster-hp");
    this.attackLine = document.getElementById("monster-attack-line");
    this.attackCdEl = document.getElementById("monster-attack-cd");
    this.attackDmgEl = document.getElementById("monster-attack-dmg");
    this.settleLine = document.getElementById("settle-line");
    this.settleLeftEl = document.getElementById("settle-left");
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

    window.addEventListener("keydown", this.onKey);
    window.addEventListener("resize", this.onResize);
    this.onBoardClick = () => this.clearSelect();
    this.board.addEventListener("touchstart", this.onTouchStart, { passive: true });
    this.board.addEventListener("touchend", this.onTouchEnd);
    this.board.addEventListener("click", this.onBoardClick);

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
      this.board.removeEventListener("click", this.onBoardClick);
    }
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

  /** 按战斗盘区域大小决定行列数，只在开新局时调用，局中不变 */
  configureGridSize() {
    const { gap, width, height } = this.boardInnerSize();
    const fit = (length) =>
      Math.max(this.MIN_LINES, Math.floor((length + gap) / (this.CELL_TARGET + gap)));
    GameEngine.setSize(fit(height), fit(width));
  },

  layout() {
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
      btn.classList.toggle("is-active", btn.dataset.tab === name);
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
    this.stats = Stats.createPlayer();
    this.blessingState = Blessings.createState();
    this.burns = { player: false, monster: false };
    this.shields = [];
    this.storedDamage = null;
    this.extraLocked = new Set();
    this.curseFrozen = new Set();
    this.monsterCurses = typeof Curses !== "undefined" ? Curses.emptyState() : null;
    this.minSpawnValue = 2;
    if (typeof GameEngine !== "undefined") {
      GameEngine.extraLocked = this.extraLocked;
      GameEngine.curseFrozen = null;
    }
    this.stats.maxHp = this.PLAYER_MAX;
    this.stats.hp = this.PLAYER_MAX;
    this.syncHpFromStats();
    this.surviveSec = 0;
    this.startedAt = Date.now();
    this.over = false;
    this.busy = false;
    this.attacking = false;
    this.clearSelect();
    this.boardCarry = null;
    this.layer.innerHTML = "";
    this.configureGridSize();
    this.layout();
    this.buildGrid();
    this.startAttackCycle();
    this.spawnMonster();
    this.addRandomTile();
    this.addRandomTile();
    this.setTab("board", { animate: false });
    this.draw(false);
    this.updateHud();
    this.startLoops();
  },

  syncHpFromStats() {
    if (!this.stats) this.stats = Stats.createPlayer();
    Blessings.clampFuryMaxHp(this);
    Stats.clampHp(this.stats);
    this.playerMax = this.stats.maxHp;
    this.playerHp = this.stats.hp;
  },

  syncStatsFromHp() {
    if (!this.stats) this.stats = Stats.createPlayer();
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
    this.resetSettleCounter();
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

  /** 方块颜色 = 下一次攻击的元素；左上角箭头表示它对怪物克制 / 被克制 */
  paintTile(tile) {
    if (!tile.el) return;
    const element = this.nextAttackElement();
    tile.el.dataset.element = element;
    let mark = tile.el.querySelector(".tile-advantage");
    if (!mark) {
      mark = document.createElement("span");
      mark.className = "tile-advantage";
      mark.setAttribute("aria-hidden", "true");
      tile.el.prepend(mark);
    }
    mark.classList.remove("is-up", "is-down");
    mark.textContent = "";
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
    if (hp <= 0) return;
    const life =
      actionsLeft == null || actionsLeft === undefined
        ? null
        : Math.max(0, Math.floor(Number(actionsLeft)));
    this.shields.push({ amount: hp, actionsLeft: life });
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
      if (!this.stats) this.stats = Stats.createPlayer();
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

  addRandomTile() {
    const empties = [];
    for (let row = 0; row < this.ROWS; row += 1) {
      for (let col = 0; col < this.COLS; col += 1) {
        if (GameEngine.isPlayable(row, col) && !this.tileAt(row, col)) {
          empties.push({ row, col });
        }
      }
    }
    if (!empties.length) return;
    const spot = empties[Math.floor(Math.random() * empties.length)];
    this.addTileAt(spot.row, spot.col, Blessings.spawnValue(this));
  },

  addTile(value) {
    const empties = [];
    for (let row = 0; row < this.ROWS; row += 1) {
      for (let col = 0; col < this.COLS; col += 1) {
        if (GameEngine.isPlayable(row, col) && !this.tileAt(row, col)) {
          empties.push({ row, col });
        }
      }
    }
    if (!empties.length) return false;
    const spot = empties[Math.floor(Math.random() * empties.length)];
    this.addTileAt(spot.row, spot.col, value);
    return true;
  },

  addTileAt(row, col, value, element = null) {
    this.tiles.push({
      id: this.nextId++,
      row,
      col,
      value,
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
    this.clearSelect();

    this.tiles.forEach((tile) => {
      tile.merged = false;
      tile.isNew = false;
      tile.justMerged = false;
    });

    const result = GameEngine.move(this.tiles, dir);
    if (!result.moved) return;

    // 合成类祝福（跃升 / 引燃 / 蓄甲 / 滋生）按「下一次攻击的元素」判定
    const swipeElement = this.nextAttackElement();

    result.tiles.forEach((next) => {
      const tile = this.tiles.find((item) => item.id === next.id);
      if (!tile) return;
      // 滑动阶段只改位置；数字等滑完再改
      tile.row = next.row;
      tile.col = next.col;
      tile.removed = next.removed;
      tile.merged = next.merged;
      tile.justMerged = next.justMerged;
      if (next.justMerged) {
        tile.pendingValue = next.value;
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
      this.tiles.forEach((tile) => {
        if (tile.pendingValue != null) {
          didMerge = true;
          mergeCount += 1;
          let value = tile.pendingValue;
          tile.pendingValue = null;
          // 跃升：风方向合成后有概率再翻倍
          if (Blessings.rollWindAscent(this, swipeElement)) {
            value *= 2;
          }
          tile.value = value;
        }
      });
      // 引燃：火方向且本次有合成时，有概率标记下次攻击必上灼烧
      if (didMerge) Blessings.rollFireIgnite(this, swipeElement);
      // 蓄甲：土方向每合成一次 +1 护盾
      if (mergeCount > 0) Blessings.grantEarthArmorShields(this, swipeElement, mergeCount);
      // 滋生：水方向合成时有概率再生成一块
      if (didMerge && Blessings.rollWaterSpawn(this, swipeElement)) {
        this.addRandomTile();
      }
      this.addRandomTile();
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

  bindTile(tile) {
    if (!tile.el || tile.el.dataset.bound === "1") return;
    tile.el.dataset.bound = "1";
    tile.el.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.selectOrEliminate(tile);
    });
    tile.el.addEventListener("touchend", (event) => {
      if (this.touchStart) {
        const point = event.changedTouches[0];
        const moved = Math.hypot(
          point.clientX - this.touchStart.x,
          point.clientY - this.touchStart.y
        );
        if (moved >= 28) return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.ignoreSwipe = true;
      this.selectOrEliminate(tile);
    });
  },

  selectOrEliminate(tile) {
    if (this.busy || this.over || this.rolling || !tile || tile.removed) return;
    if (this.selected === tile) {
      this.clearSelect();
      this.eliminateTile(tile);
      return;
    }
    this.selectTile(tile);
  },

  selectTile(tile) {
    this.clearSelect();
    this.selected = tile;
    if (tile.el) tile.el.classList.add("is-aimed");
    TutorialGuide.notify("select");
    if (TutorialGuide.isActive()) TutorialGuide.refreshFocus();
  },

  clearSelect() {
    if (this.selected && this.selected.el) {
      this.selected.el.classList.remove("is-aimed");
    }
    this.selected = null;
  },

  /** 消除：双击移走一个方块，算一次战斗回合 */
  eliminateTile(tile) {
    if (this.busy || this.over || this.rolling || !tile || tile.removed || !tile.el) return;
    this.clearSelect();

    const info = { value: tile.value, element: tile.element || null };
    const el = tile.el;
    tile.removed = true;
    this.tiles = this.tiles.filter((item) => item !== tile);
    el.classList.remove("is-spawn", "is-merge", "is-aimed");
    el.classList.add("is-vanish");
    window.setTimeout(() => el.remove(), 220);

    this.onEliminate(info);
    Blessings.resetAttackCombo(this);
    // 棋盘空了就走不了棋，补一块保证还能继续
    if (this.tiles.length === 0) {
      this.addRandomTile();
      this.draw(false);
    }
    TutorialGuide.notify("eliminate");
    this.endPlayerRound();
    if (TutorialGuide.isActive()) TutorialGuide.refreshFocus();
  },

  /**
   * 消除方块的额外效果（待设计）。
   * @param {{ value: number, element: string|null }} info 被消除方块的数字与元素
   */
  onEliminate(info) {},

  /**
   * 一次完整操作（滑动 / 消除 / 道具）结束 = 一个战斗回合：
   * 结算倒计时减 1，归零时按场上方块结算伤害；怪物没死，再推进它的出手倒计时。
   * 道具等新操作在效果生效后调用本方法即可计入回合。
   */
  endPlayerRound() {
    if (this.over || this.monsterHp <= 0) return;
    this.settleLeft = Math.max(0, this.settleLeft - 1);
    if (this.settleLeft <= 0) {
      this.settleBoard();
      this.resetSettleCounter();
    } else {
      this.updateSettleHud();
    }
    if (this.over || this.monsterHp <= 0) return;
    this.registerAction();
  },

  resetSettleCounter() {
    this.settleLeft = Math.max(1, this.SETTLE_ROUNDS);
    this.updateSettleHud();
  },

  updateSettleHud() {
    if (!this.settleLeftEl) return;
    this.settleLeftEl.textContent = String(this.settleLeft);
    if (this.settleLine) this.settleLine.classList.toggle("is-soon", this.settleLeft <= 1);
  },

  /** 结算：场上每个方块的数字各算一次，累加后按本次攻击元素打向怪物 */
  settleBoard() {
    const live = this.tiles.filter((tile) => !tile.removed);
    if (!live.length) return;
    const total = live.reduce((sum, tile) => sum + tile.value, 0);
    const element = this.takeAttackElement();
    this.lastAttackElement = element;
    this.hitMonster([{ amount: total, element }]);
    this.paintTiles();
  },

  /** 攻击元素周期：每 4 次攻击里水火土风各出现一次，顺序随机 */
  refillAttackCycle() {
    const bag = Elements.LIST.slice();
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    this.attackCycle = bag;
  },

  nextAttackElement() {
    if (!Array.isArray(this.attackCycle) || !this.attackCycle.length) this.refillAttackCycle();
    return this.attackCycle[0];
  },

  takeAttackElement() {
    const element = this.nextAttackElement();
    this.attackCycle.shift();
    if (!this.attackCycle.length) this.startAttackCycle();
    return element;
  },

  /** 新一轮攻击元素：洗好顺序后播放老虎机动画告诉玩家 */
  startAttackCycle() {
    this.refillAttackCycle();
    this.playCycleSlot(this.attackCycle.slice());
  },

  /** 老虎机：每个转轮滚过若干随机元素后停在本轮对应位置，从左到右依次停下 */
  playCycleSlot(order) {
    this.clearSlot();
    if (!this.board) return;
    this.rolling = true;
    this.clearSelect();

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
      const symbols = [];
      const spins = 12 + i * 5;
      for (let k = 0; k < spins; k += 1) {
        symbols.push(Elements.LIST[Math.floor(Math.random() * Elements.LIST.length)]);
      }
      symbols.push(target);
      strip.innerHTML = symbols.map(badge).join("");
      strip.style.transitionDuration = `${this.SLOT_SPIN_MS + i * this.SLOT_STAGGER_MS}ms`;
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
      window.setTimeout(() => overlay.classList.add("is-leaving"), allStopped + this.SLOT_HOLD_MS)
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
    this.rolling = false;
  },

  /**
   * 玩家的一次攻击。
   * @param {{ amount: number, element: string|null }[]} parts 每组按自身元素单独算克制，最后合并成一次伤害
   */
  hitMonster(parts) {
    if (this.over) return;
    if (!this.stats) this.stats = Stats.createPlayer();
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

  captureBoard() {
    this.boardCarry = this.tiles
      .filter((tile) => !tile.removed)
      .map((tile) => ({
        row: tile.row,
        col: tile.col,
        value: tile.value,
        element: tile.element
      }));
  },

  restoreBoard() {
    const carry = this.boardCarry;
    if (!carry) return;
    this.boardCarry = null;
    this.clearSelect();
    this.tiles.forEach((tile) => {
      if (tile.el) tile.el.remove();
    });
    this.tiles = [];
    if (this.layer) this.layer.innerHTML = "";
    carry.forEach((tile) => {
      this.addTileAt(tile.row, tile.col, tile.value, tile.element);
    });
    this.tiles.forEach((tile) => {
      tile.isNew = false;
    });
  },

  hurtPlayer(amount) {
    if (this.over) return;
    if (!this.stats) this.stats = Stats.createPlayer();
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
    const remain = this.absorbWithShield(incoming);
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
      if (!this.stats) this.stats = Stats.createPlayer();
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
    this.attackCdEl.textContent = `还剩 ${this.actionsLeft} 次`;
    this.attackDmgEl.textContent = String(this.monsterDamage());
    this.attackLine.classList.toggle("is-soon", this.actionsLeft <= 1);
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
          `<span class="tile-value"></span>`;
        this.layer.appendChild(tile.el);
        this.bindTile(tile);
      }

      const { x, y } = this.pos(tile.row, tile.col);
      this.paintTile(tile);
      // 滑动动画中数字等停稳再刷新
      if (!animate) {
        tile.el.dataset.value = String(tile.value);
        const valueEl = tile.el.querySelector(".tile-value");
        if (valueEl) valueEl.textContent = tile.value;
      }
      tile.el.style.setProperty("--x", `${x}px`);
      tile.el.style.setProperty("--y", `${y}px`);

      tile.el.classList.toggle("is-spawn", tile.isNew && !animate);
      tile.el.classList.toggle("is-merge", tile.justMerged && !animate);
      tile.el.classList.toggle("is-aimed", this.selected === tile);

      if (!animate) {
        tile.el.style.transition = "none";
        void tile.el.offsetWidth;
        tile.el.style.transition = "";
      }
    });
  },

  updateHud() {
    this.syncHpFromStats();
    this.waveEl.textContent = this.trial ? "试玩" : String(this.wave);
    this.updateAttackHud();
    this.updateSettleHud();
    this.updateMonsterElement();
    this.playerHpText.textContent = String(this.playerHp);
    this.monsterHpText.textContent = String(this.monsterHp);
    this.playerFill.style.transform = `scaleX(${this.playerHp / this.playerMax})`;
    this.monsterFill.style.transform = `scaleX(${this.monsterMax ? this.monsterHp / this.monsterMax : 0})`;
  }
};

App.register("game", GameScene);
