/**
 * 游戏界面：上半区是怪物，下半区是四角锁定的 2048。
 * 合成只负责把数字变大；双击方块会把它丢掉，数字就是打怪伤害。
 */
const GameScene = {
  el: document.getElementById("gamescene"),
  SIZE: 4,
  MOVE_MS: 170,
  PLAYER_MAX: 100,
  WIND_MS: 420,
  MONSTER_NAMES: ["黑团团", "灰刺球", "暗影块", "墨晶兽", "白影王"],
  tiles: [],
  nextId: 1,
  score: 0,
  wave: 1,
  playerHp: 100,
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
  playerMax: 100,
  buffs: {
    incomingReduce: 0,
    extraActions: 0,
    damageFlat: 0,
    lifesteal: 0
  },

  enter(data) {
    this.cacheDom();
    this.bind();
    this.layout();
    if (data.afterUpgrade) {
      this.restoreBoard();
      if (data.upgradeId && typeof UpgradeScene !== "undefined") {
        const card = UpgradeScene.POOL.find((item) => item.id === data.upgradeId);
        if (card) card.apply(this);
      }
      this.spawnMonster();
      this.draw(false);
      this.updateHud();
      this.startLoops();
      return;
    }
    if (data.resume && this.tiles.length && !this.over) {
      this.draw(false);
      this.updateHud();
      this.startLoops();
      return;
    }
    this.newGame();
    if (data.tutorial || TutorialGuide.shouldStart(data)) {
      window.setTimeout(() => TutorialGuide.start(), 80);
    }
  },

  leave() {
    if (TutorialGuide.isActive()) TutorialGuide.dismiss(false);
    this.stopLoops();
    this.unbind();
    this.el.hidden = true;
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
    this.monsterElementEl = document.getElementById("monster-element");
  },

  bind() {
    this.onKey = (event) => this.handleKey(event);
    this.onResize = () => {
      this.layout();
      this.draw(false);
      if (TutorialGuide.isActive()) TutorialGuide.refreshFocus();
    };
    this.onTouchStart = (event) => {
      const point = event.changedTouches[0];
      this.touchStart = { x: point.clientX, y: point.clientY };
    };
    this.onTouchEnd = (event) => this.handleSwipe(event);
    this.ignoreSwipe = false;

    window.addEventListener("keydown", this.onKey);
    window.addEventListener("resize", this.onResize);
    this.onBoardClick = () => this.clearSelect();
    this.board.addEventListener("touchstart", this.onTouchStart, { passive: true });
    this.board.addEventListener("touchend", this.onTouchEnd);
    this.board.addEventListener("click", this.onBoardClick);

    document.getElementById("game-menu").onclick = () => App.show("menu");
    document.getElementById("game-restart").onclick = () => {
      if (TutorialGuide.isActive()) TutorialGuide.end();
      this.newGame();
    };
  },

  unbind() {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("resize", this.onResize);
    if (this.board) {
      this.board.removeEventListener("touchstart", this.onTouchStart);
      this.board.removeEventListener("touchend", this.onTouchEnd);
      this.board.removeEventListener("click", this.onBoardClick);
    }
  },

  layout() {
    const hud = 40;
    const box = Math.max(188, Math.floor(Math.min(this.lowerEl.clientWidth, this.lowerEl.clientHeight - hud)));
    this.board.style.width = `${box}px`;
    this.board.style.height = `${box}px`;
    const playerHp = this.lowerEl.querySelector(".player-hp");
    if (playerHp) playerHp.style.maxWidth = `${box}px`;
    const monsterHp = this.el.querySelector(".monster-hp");
    if (monsterHp) monsterHp.style.maxWidth = `${box}px`;
    const styles = getComputedStyle(this.board);
    const pad = parseFloat(styles.paddingLeft);
    const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap"));
    const cell = (box - pad * 2 - gap * (this.SIZE - 1)) / this.SIZE;
    this.pad = pad;
    this.gap = gap;
    this.cell = cell;
    document.documentElement.style.setProperty("--cell", `${cell}px`);
    document.documentElement.style.setProperty("--pad", `${pad}px`);
  },

  newGame() {
    this.stopLoops();
    this.tiles = [];
    this.nextId = 1;
    this.score = 0;
    this.wave = 1;
    this.boardElement = null;
    this.playerMax = this.PLAYER_MAX;
    this.buffs = {
      incomingReduce: 0,
      extraActions: 0,
      damageFlat: 0,
      lifesteal: 0
    };
    this.playerHp = this.playerMax;
    this.surviveSec = 0;
    this.startedAt = Date.now();
    this.over = false;
    this.busy = false;
    this.attacking = false;
    this.clearSelect();
    this.boardCarry = null;
    this.layer.innerHTML = "";
    this.buildGrid();
    this.spawnMonster();
    this.addRandomTile();
    this.addRandomTile();
    this.draw(false);
    this.updateHud();
    this.startLoops();
  },

  buildGrid() {
    this.grid.innerHTML = "";
    for (let i = 0; i < this.SIZE * this.SIZE; i += 1) {
      const row = Math.floor(i / this.SIZE);
      const col = i % this.SIZE;
      const cell = document.createElement("div");
      cell.className = GameEngine.isPlayable(row, col) ? "cell" : "cell is-locked";
      if (!GameEngine.isPlayable(row, col)) cell.textContent = "锁";
      this.grid.appendChild(cell);
    }
  },

  monsterHpFor(wave) {
    // 第 1 波固定 20 血，后面再逐渐变厚
    const n = Math.max(0, wave - 1);
    return Math.round(20 + n * 24 + n * n * 4);
  },

  monsterDamage() {
    return Math.max(1, 6 + this.wave * 2 - this.buffs.incomingReduce);
  },

  actionsPerAttack() {
    return Math.max(3, 7 - Math.floor((this.wave - 1) / 2) + this.buffs.extraActions);
  },

  monsterElement: "water",

  spawnMonster() {
    this.monsterMax = this.monsterHpFor(this.wave);
    this.monsterHp = this.monsterMax;
    this.monsterElement = Elements.random();
    this.monsterName.textContent = this.MONSTER_NAMES[(this.wave - 1) % this.MONSTER_NAMES.length];
    this.monsterEl.classList.remove("is-hit", "is-wind", "is-dead");
    this.resetActionCounter();
    this.updateMonsterElement();
  },

  updateTileAdvantage(tile) {
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
    if (!tile.element) return;
    const mult = Elements.multiplier(tile.element, this.monsterElement);
    if (mult === 2) {
      mark.textContent = "▲";
      mark.classList.add("is-up");
    } else if (mult === 0.5) {
      mark.textContent = "▼";
      mark.classList.add("is-down");
    }
  },

  updateMonsterElement() {
    if (!this.monsterElementEl) return;
    const meta = Elements.meta(this.monsterElement);
    this.monsterElementEl.innerHTML =
      `<span class="element-badge" data-element="${meta.id}">${meta.short}</span>` +
      `<span>${meta.name}属性</span>`;
    // 怪物属性变了，所有格子的克制箭头也要跟着刷新
    this.tiles.forEach((tile) => this.updateTileAdvantage(tile));
  },

  resetActionCounter() {
    this.actionsLeft = this.actionsPerAttack();
    this.attacking = false;
    this.updateAttackHud();
  },

  registerAction() {
    if (TutorialGuide.blocksCombat()) return;
    if (this.over || this.attacking || this.monsterHp <= 0) return;
    this.actionsLeft = Math.max(0, this.actionsLeft - 1);
    this.updateAttackHud();
    if (this.actionsLeft <= 0) this.triggerMonsterAttack();
  },

  triggerMonsterAttack() {
    if (this.over || this.attacking) return;
    this.attacking = true;
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
    for (let row = 0; row < this.SIZE; row += 1) {
      for (let col = 0; col < this.SIZE; col += 1) {
        if (GameEngine.isPlayable(row, col) && !this.tileAt(row, col)) {
          empties.push({ row, col });
        }
      }
    }
    if (!empties.length) return;
    const spot = empties[Math.floor(Math.random() * empties.length)];
    this.addTileAt(spot.row, spot.col, Math.random() < 0.9 ? 2 : 4);
  },

  addTile(value) {
    const empties = [];
    for (let row = 0; row < this.SIZE; row += 1) {
      for (let col = 0; col < this.SIZE; col += 1) {
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
    if (this.busy || this.over) return;
    this.clearSelect();

    this.tiles.forEach((tile) => {
      tile.merged = false;
      tile.isNew = false;
      tile.justMerged = false;
    });

    const result = GameEngine.move(this.tiles, dir);
    if (!result.moved) return;

    // 成功滑动：所有有数字的格子统一成该方向的元素
    const swipeElement = Elements.fromDir(dir);
    this.boardElement = swipeElement;

    result.tiles.forEach((next) => {
      const tile = this.tiles.find((item) => item.id === next.id);
      if (!tile) return;
      // 滑动阶段只改位置；数字等滑完再改
      tile.row = next.row;
      tile.col = next.col;
      tile.removed = next.removed;
      tile.merged = next.merged;
      tile.justMerged = next.justMerged;
      if (!tile.removed) tile.element = swipeElement;
      if (next.justMerged) {
        tile.pendingValue = next.value;
      }
    });

    this.busy = true;
    this.draw(true);
    this.registerAction();
    TutorialGuide.notify("move");

    window.setTimeout(() => {
      this.tiles = this.tiles.filter((tile) => {
        if (!tile.removed) return true;
        if (tile.el) tile.el.remove();
        return false;
      });
      this.tiles.forEach((tile) => {
        if (tile.pendingValue != null) {
          tile.value = tile.pendingValue;
          tile.pendingValue = null;
        }
      });
      // 新冒出来的格子保持白色，等下次成功滑动再染色
      this.addRandomTile();
      this.draw(false);
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
      this.selectOrLaunch(tile);
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
      this.selectOrLaunch(tile);
    });
  },

  selectOrLaunch(tile) {
    if (this.busy || this.over || !tile || tile.removed) return;
    if (this.selected === tile) {
      this.clearSelect();
      this.launchTile(tile);
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

  launchTile(tile) {
    if (this.busy || this.over || !tile || tile.removed || !tile.el) return;
    this.clearSelect();

    const value = tile.value;
    const element = tile.element || Elements.random();
    const from = tile.el.getBoundingClientRect();
    const fly = tile.el.cloneNode(true);
    fly.classList.add("tile-fly");
    fly.classList.remove("is-spawn", "is-merge", "is-aimed");
    fly.style.left = `${from.left}px`;
    fly.style.top = `${from.top}px`;
    fly.style.width = `${from.width}px`;
    fly.style.height = `${from.height}px`;
    fly.style.transform = "translate(0, 0)";
    fly.style.setProperty("--x", "0px");
    fly.style.setProperty("--y", "0px");
    document.body.appendChild(fly);

    tile.removed = true;
    tile.el.remove();
    this.tiles = this.tiles.filter((item) => item !== tile);

    const to = this.monsterEl.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        fly.style.transform = `translate(${dx}px, ${dy}px) scale(0.35)`;
        fly.style.opacity = "0.2";
      });
    });

    window.setTimeout(() => {
      fly.remove();
      this.hitMonster(value, element);
      TutorialGuide.notify("launch");
      if (!this.over && this.monsterHp > 0) this.registerAction();
      if (!this.over && this.monsterHp > 0 && this.tiles.length === 0) {
        this.addRandomTile();
        this.draw(false);
      }
      if (TutorialGuide.isActive()) TutorialGuide.refreshFocus();
    }, 420);
  },

  hitMonster(amount, attackElement) {
    if (this.over) return;
    const base = amount + this.buffs.damageFlat;
    const mult = Elements.multiplier(attackElement, this.monsterElement);
    const dealt = Elements.applyDamage(base, attackElement, this.monsterElement);
    if (TutorialGuide.isActive()) {
      this.popDamage(dealt, this.monsterEl, "fx-shot", mult, "练习");
      this.flashHit(this.monsterEl, "is-hit");
      return;
    }
    this.score += dealt;
    this.monsterHp = Math.max(0, this.monsterHp - dealt);
    if (this.buffs.lifesteal > 0) {
      this.playerHp = Math.min(this.playerMax, this.playerHp + Math.round(dealt * this.buffs.lifesteal));
    }
    this.popDamage(dealt, this.monsterEl, "fx-shot", mult);
    this.flashHit(this.monsterEl, "is-hit");
    this.flashHit(this.monsterHpRow, "is-struck");
    this.updateHud();
    if (this.monsterHp <= 0) this.nextWave();
  },

  popDamage(amount, target, className, mult, label) {
    const pop = document.createElement("div");
    pop.className = className;
    if (label) pop.textContent = label;
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
    this.wave += 1;
    this.updateHud();
    window.setTimeout(() => {
      if (this.over) return;
      App.show("upgrade");
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
    if (carry.length) {
      this.boardElement = carry.find((tile) => tile.element)?.element || null;
    }
    carry.forEach((tile) => {
      this.addTileAt(tile.row, tile.col, tile.value, tile.element);
    });
    this.tiles.forEach((tile) => {
      tile.isNew = false;
    });
  },

  hurtPlayer(amount) {
    if (this.over) return;
    this.playerHp = Math.max(0, this.playerHp - amount);
    document.body.classList.remove("is-hurt");
    void document.body.offsetWidth;
    document.body.classList.add("is-hurt");
    this.flashHit(this.playerHpRow, "is-struck");
    this.popDamage(amount, this.playerHpRow, "fx-shot is-player");
    window.setTimeout(() => document.body.classList.remove("is-hurt"), 560);
    this.updateHud();
    if (this.playerHp <= 0) this.endRun();
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
      x: col * (this.cell + this.gap),
      y: row * (this.cell + this.gap)
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
      if (tile.element) {
        tile.el.dataset.element = tile.element;
      } else {
        delete tile.el.dataset.element;
      }
      // 滑动动画中数字等停稳再刷新；已有属性的格子马上变色
      if (!animate) {
        tile.el.dataset.value = String(tile.value);
        const valueEl = tile.el.querySelector(".tile-value");
        if (valueEl) valueEl.textContent = tile.value;
        this.updateTileAdvantage(tile);
      } else {
        this.updateTileAdvantage(tile);
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
    this.waveEl.textContent = String(this.wave);
    this.updateAttackHud();
    this.updateMonsterElement();
    this.playerHpText.textContent = String(this.playerHp);
    this.monsterHpText.textContent = String(this.monsterHp);
    this.playerFill.style.transform = `scaleX(${this.playerHp / this.playerMax})`;
    this.monsterFill.style.transform = `scaleX(${this.monsterMax ? this.monsterHp / this.monsterMax : 0})`;
  }
};

App.register("game", GameScene);
