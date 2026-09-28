/**
 * 诅咒系统：挂在怪物身上，本波生效，换怪后重 roll。
 * 污染 / 封堵 / 威慑 / 封锁 / 潜藏 / 污泥
 */
const Curses = {
  IDS: ["pollution", "block", "deter", "lockout", "lurk", "sludge"],

  DEFS: {
    pollution: {
      id: "pollution",
      name: "污染",
      desc: "玩家每次结算伤害时，自身受到 5 点伤害"
    },
    block: {
      id: "block",
      name: "封堵",
      desc: "冻结玩家的其中一个格子"
    },
    deter: {
      id: "deter",
      name: "威慑",
      desc: "只能受到随机两个元素的伤害"
    },
    lockout: {
      id: "lockout",
      name: "封锁",
      desc: "某个元素的方块不参与伤害结算（化X 等改结算后按结算元素判定）"
    },
    lurk: {
      id: "lurk",
      name: "潜藏",
      desc: "怪物等待次数翻倍，但造成伤害 ×4"
    },
    sludge: {
      id: "sludge",
      name: "污泥",
      desc: "玩家的所有攻击伤害减半"
    }
  },

  emptyState() {
    return {
      ids: [],
      /** 威慑：可受伤的元素 */
      deterElements: null,
      /** 封锁：禁止的门闩元素（见 gateElement） */
      lockoutElement: null,
      /** 封堵：冻结的格子 "r,c" */
      frozenKey: null
    };
  },

  find(id) {
    return this.DEFS[id] || null;
  },

  has(game, id) {
    const state = game && game.monsterCurses;
    return Boolean(state && Array.isArray(state.ids) && state.ids.includes(id));
  },

  /**
   * 按波次给当前怪挂诅咒：第 1 波没有；之后有概率附带 1 个。
   */
  rollForWave(wave, rng = Math.random) {
    const w = Math.max(1, Math.floor(Number(wave) || 1));
    if (w <= 1) return [];
    // 第 2 波起 55%，第 6 波起必带 1 个
    const chance = w >= 6 ? 1 : 0.55;
    if (rng() >= chance) return [];
    const pool = this.IDS.slice();
    const idx = Math.floor(rng() * pool.length);
    return [pool[idx]];
  },

  /** 清掉上一只怪的诅咒冻结格 */
  clear(game) {
    if (!game) return;
    game.monsterCurses = this.emptyState();
    if (game.curseFrozen) game.curseFrozen.clear();
    this.syncEngine(game);
  },

  syncEngine(game) {
    if (typeof GameEngine === "undefined") return;
    GameEngine.curseFrozen = game.curseFrozen && game.curseFrozen.size ? game.curseFrozen : null;
    GameEngine.extraLocked = game.extraLocked || null;
  },

  /**
   * 给当前怪附上诅咒并立即生效（封堵锁格等）。
   */
  applyToMonster(game, curseIds, rng = Math.random) {
    this.clear(game);
    const ids = (curseIds || []).filter((id) => this.DEFS[id]);
    const state = this.emptyState();
    state.ids = ids.slice();
    game.monsterCurses = state;
    if (!game.curseFrozen) game.curseFrozen = new Set();

    const ElementsLib =
      typeof Elements !== "undefined" ? Elements : require("./elements.js").Elements;

    if (ids.includes("deter")) {
      const pool = ElementsLib.LIST.slice();
      const picked = [];
      while (picked.length < 2 && pool.length) {
        const i = Math.floor(rng() * pool.length);
        picked.push(pool.splice(i, 1)[0]);
      }
      state.deterElements = picked;
    }

    if (ids.includes("lockout")) {
      state.lockoutElement = ElementsLib.LIST[Math.floor(rng() * ElementsLib.LIST.length)];
    }

    if (ids.includes("block")) {
      this.freezeOneCell(game, rng);
    }

    this.syncEngine(game);
    if (typeof game.refreshLockedCells === "function") game.refreshLockedCells();
    if (ids.includes("block") && typeof game.evacuateLockedTiles === "function") {
      game.evacuateLockedTiles();
    }
    return state;
  },

  freezeOneCell(game, rng = Math.random) {
    if (!game.curseFrozen) game.curseFrozen = new Set();
    const blessingLocked = game.extraLocked || new Set();
    const engine =
      typeof GameEngine !== "undefined" ? GameEngine : require("./gameengine.js").GameEngine;
    const candidates = [];
    for (let row = 0; row < engine.ROWS; row += 1) {
      for (let col = 0; col < engine.COLS; col += 1) {
        const key = `${row},${col}`;
        if (blessingLocked.has(key)) continue;
        if (game.curseFrozen.has(key)) continue;
        candidates.push(key);
      }
    }
    if (!candidates.length) return;
    const key = candidates[Math.floor(rng() * candidates.length)];
    game.curseFrozen.add(key);
    game.monsterCurses.frozenKey = key;
  },

  /** 潜藏：等待次数翻倍 */
  modifyActionsPerAttack(game, base) {
    if (!this.has(game, "lurk")) return base;
    return Math.max(1, Math.floor(Number(base) || 1) * 2);
  },

  /** 潜藏：怪物伤害 ×4 */
  modifyMonsterDamage(game, base) {
    if (!this.has(game, "lurk")) return base;
    return Math.max(1, Math.floor(Number(base) || 0) * 4);
  },

  /**
   * 封锁门闩用的元素：
   * - 有「化X」时看最终结算元素
   * - 否则看参与结算的方块自身元素
   */
  gateElement(game, tileElement, settlementElement) {
    const force =
      game && game.blessingState && Array.isArray(game.blessingState.forceElements)
        ? game.blessingState.forceElements
        : [];
    if (force.length) return settlementElement || null;
    return tileElement || null;
  },

  /**
   * 玩家攻击前拦截：返回 { blocked, reason, damageMult }
   * blocked 时本下不对怪造成伤害（污染仍可能触发，由调用方决定顺序）。
   */
  beforePlayerAttack(game, tileElement, settlement) {
    const info = { blocked: false, reason: null, damageMult: 1 };
    if (!game || !game.monsterCurses || !game.monsterCurses.ids.length) return info;

    const attackEl = settlement && settlement.attackElement;

    if (this.has(game, "lockout") && game.monsterCurses.lockoutElement) {
      const gate = this.gateElement(game, tileElement, attackEl);
      if (gate && gate === game.monsterCurses.lockoutElement) {
        info.blocked = true;
        info.reason = "封锁";
        return info;
      }
    }

    if (this.has(game, "deter") && Array.isArray(game.monsterCurses.deterElements)) {
      // 无属性攻击对威慑怪无效；有属性则必须落在允许列表
      if (!attackEl || !game.monsterCurses.deterElements.includes(attackEl)) {
        info.blocked = true;
        info.reason = "威慑";
        return info;
      }
    }

    if (this.has(game, "sludge")) {
      info.damageMult *= 0.5;
    }
    return info;
  },

  /** 污染：每次攻击反噬 5 点（走 hurtPlayer，可被盾/闪避等处理） */
  applyPollution(game) {
    if (!this.has(game, "pollution")) return 0;
    if (typeof game.hurtPlayer === "function") {
      game.hurtPlayer(5);
    }
    return 5;
  },

  /** HUD / 列表展示 */
  listActive(game) {
    const state = game && game.monsterCurses;
    if (!state || !state.ids.length) return [];
    return state.ids.map((id) => {
      const def = this.find(id);
      const item = {
        id,
        name: def ? def.name : id,
        desc: def ? def.desc : ""
      };
      if (id === "deter" && Array.isArray(state.deterElements)) {
        const ElementsLib =
          typeof Elements !== "undefined" ? Elements : require("./elements.js").Elements;
        item.detail = state.deterElements.map((el) => ElementsLib.meta(el).name).join("、");
      }
      if (id === "lockout" && state.lockoutElement) {
        const ElementsLib =
          typeof Elements !== "undefined" ? Elements : require("./elements.js").Elements;
        item.detail = ElementsLib.meta(state.lockoutElement).name;
      }
      return item;
    });
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Curses };
}

if (typeof window !== "undefined") {
  window.Curses = Curses;
}
