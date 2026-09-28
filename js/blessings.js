/**
 * 祝福系统：完成目标后三选一。
 * 分类：元素 / 生存 / 攻击。
 * 玩家可见：name、desc、rarity 对应颜色；note 仅开发备忘，不展示。
 */
const Blessings = {
  CATEGORIES: {
    element: "元素",
    survival: "生存",
    attack: "攻击"
  },

  /** 稀有度 → 展示色（CSS data-rarity 用） */
  RARITY: {
    white: { id: "white", name: "白", color: "#c8c8c8" },
    blue: { id: "blue", name: "蓝", color: "#2f80ed" },
    purple: { id: "purple", name: "紫", color: "#9b51e0" },
    gold: { id: "gold", name: "金", color: "#e0a800" }
  },

  /**
   * 祝福池（元素 + 生存 + 攻击）。
   * note：说明列，不进 UI。
   */
  POOL: [
    {
      id: "elem-wind-boost-white",
      category: "element",
      rarity: "white",
      name: "元素强化·风",
      desc: "风元素加成+20%",
      apply(game) {
        game.stats.windDmgBonus += 20;
      }
    },
    {
      id: "elem-wind-boost-blue",
      category: "element",
      rarity: "blue",
      name: "元素强化·风",
      desc: "风元素加成+50%",
      apply(game) {
        game.stats.windDmgBonus += 50;
      }
    },
    {
      id: "elem-wind-boost-purple",
      category: "element",
      rarity: "purple",
      name: "元素强化·风",
      desc: "风元素加成+80%",
      apply(game) {
        game.stats.windDmgBonus += 80;
      }
    },
    {
      id: "elem-wind-boost-gold",
      category: "element",
      rarity: "gold",
      name: "元素强化·风",
      desc: "风元素加成+120%",
      apply(game) {
        game.stats.windDmgBonus += 120;
      }
    },
    {
      id: "elem-wind-ascent",
      category: "element",
      rarity: "white",
      name: "跃升",
      desc: "作为风方块合成时，合成后有1%的概率数字翻倍",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-wind-ascent");
      }
    },
    {
      id: "elem-wind-echo",
      category: "element",
      rarity: "blue",
      name: "回响",
      desc: "用风元素攻击时，额外追加1次攻击",
      note: "追加的攻击视为一次独立攻击",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-wind-echo");
      }
    },
    {
      id: "elem-wind-convert",
      category: "element",
      rarity: "purple",
      name: "化风",
      desc: "所有的攻击视为风元素攻击（与方块自身属性无关）",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-wind-convert");
        Blessings.addForceElement(game, "wind");
      }
    },
    {
      id: "elem-light-body",
      category: "element",
      rarity: "purple",
      name: "轻身",
      desc: "受到攻击时，有5%的概率免疫此次攻击",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-light-body");
      }
    },
    {
      id: "elem-fire-boost-white",
      category: "element",
      rarity: "white",
      name: "元素强化·火",
      desc: "火元素加成+20%",
      apply(game) {
        game.stats.fireDmgBonus += 20;
      }
    },
    {
      id: "elem-fire-boost-blue",
      category: "element",
      rarity: "blue",
      name: "元素强化·火",
      desc: "火元素加成+50%",
      apply(game) {
        game.stats.fireDmgBonus += 50;
      }
    },
    {
      id: "elem-fire-boost-purple",
      category: "element",
      rarity: "purple",
      name: "元素强化·火",
      desc: "火元素加成+80%",
      apply(game) {
        game.stats.fireDmgBonus += 80;
      }
    },
    {
      id: "elem-fire-boost-gold",
      category: "element",
      rarity: "gold",
      name: "元素强化·火",
      desc: "火元素加成+120%",
      apply(game) {
        game.stats.fireDmgBonus += 120;
      }
    },
    {
      id: "elem-fire-ignite",
      category: "element",
      rarity: "white",
      name: "引燃",
      desc: "作为火方块合成时，合成后有1%的概率使下一次攻击必定触发灼烧效果",
      note: "灼烧：获得该效果时，直到下一次攻击前，每动一次扣5点体力",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-fire-ignite");
      }
    },
    {
      id: "elem-fire-suppress",
      category: "element",
      rarity: "blue",
      name: "压制",
      desc: "用火元素攻击时，若克制关系为优势，则克制关系变为x3",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-fire-suppress");
      }
    },
    {
      id: "elem-fire-convert",
      category: "element",
      rarity: "purple",
      name: "化火",
      desc: "所有的攻击视为火元素攻击（与方块自身属性无关）",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-fire-convert");
        Blessings.addForceElement(game, "fire");
      }
    },
    {
      id: "elem-fire-brand",
      category: "element",
      rarity: "purple",
      name: "烙印",
      desc: "受到攻击时，有3%的概率给敌人添加一次灼烧效果",
      note: "灼烧：获得该效果时，直到下一次攻击前，每动一次扣5点体力",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-fire-brand");
      }
    },
    {
      id: "elem-earth-boost-white",
      category: "element",
      rarity: "white",
      name: "元素强化·土",
      desc: "土元素加成+20%",
      apply(game) {
        game.stats.earthDmgBonus += 20;
      }
    },
    {
      id: "elem-earth-boost-blue",
      category: "element",
      rarity: "blue",
      name: "元素强化·土",
      desc: "土元素加成+50%",
      apply(game) {
        game.stats.earthDmgBonus += 50;
      }
    },
    {
      id: "elem-earth-boost-purple",
      category: "element",
      rarity: "purple",
      name: "元素强化·土",
      desc: "土元素加成+80%",
      apply(game) {
        game.stats.earthDmgBonus += 80;
      }
    },
    {
      id: "elem-earth-boost-gold",
      category: "element",
      rarity: "gold",
      name: "元素强化·土",
      desc: "土元素加成+120%",
      apply(game) {
        game.stats.earthDmgBonus += 120;
      }
    },
    {
      id: "elem-earth-armor",
      category: "element",
      rarity: "white",
      name: "蓄甲",
      desc: "作为土方块合成时，每合成1次获得一个点数为1的护盾（可叠加）",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-earth-armor");
      }
    },
    {
      id: "elem-earth-delay",
      category: "element",
      rarity: "blue",
      name: "迟滞",
      desc: "用土元素攻击时，敌人的攻击等待次数有3%的概率+1",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-earth-delay");
      }
    },
    {
      id: "elem-earth-convert",
      category: "element",
      rarity: "purple",
      name: "化土",
      desc: "所有的攻击视为土元素攻击（与方块自身属性无关）",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-earth-convert");
        Blessings.addForceElement(game, "earth");
      }
    },
    {
      id: "elem-earth-golden",
      category: "element",
      rarity: "purple",
      name: "金身",
      desc: "受到伤害时，立刻生成一个维持3个行动的可抵挡20点伤害的护盾",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-earth-golden");
      }
    },
    {
      id: "elem-water-boost-white",
      category: "element",
      rarity: "white",
      name: "元素强化·水",
      desc: "水元素加成+20%",
      apply(game) {
        game.stats.waterDmgBonus += 20;
      }
    },
    {
      id: "elem-water-boost-blue",
      category: "element",
      rarity: "blue",
      name: "元素强化·水",
      desc: "水元素加成+50%",
      apply(game) {
        game.stats.waterDmgBonus += 50;
      }
    },
    {
      id: "elem-water-boost-purple",
      category: "element",
      rarity: "purple",
      name: "元素强化·水",
      desc: "水元素加成+80%",
      apply(game) {
        game.stats.waterDmgBonus += 80;
      }
    },
    {
      id: "elem-water-boost-gold",
      category: "element",
      rarity: "gold",
      name: "元素强化·水",
      desc: "水元素加成+120%",
      apply(game) {
        game.stats.waterDmgBonus += 120;
      }
    },
    {
      id: "elem-water-spawn",
      category: "element",
      rarity: "white",
      name: "滋生",
      desc: "作为水方块合成时，有1%的概率直接在空白位置生成一个新的方块",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-water-spawn");
      }
    },
    {
      id: "elem-water-heal",
      category: "element",
      rarity: "blue",
      name: "回春",
      desc: "用水元素攻击时，有3%的概率回复10点生命值",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-water-heal");
      }
    },
    {
      id: "elem-water-convert",
      category: "element",
      rarity: "purple",
      name: "化水",
      desc: "所有的攻击视为水元素攻击（与方块自身属性无关）",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-water-convert");
        Blessings.addForceElement(game, "water");
      }
    },
    {
      id: "elem-water-store",
      category: "element",
      rarity: "purple",
      name: "蓄伤",
      desc: "受到伤害时，有15%的概率存储伤害，等到下一次受到攻击再结算（只能存储一次伤害）",
      unique: true,
      apply(game) {
        Blessings.grant(game, "elem-water-store");
      }
    },

    // —— 生存 ——
    {
      id: "surv-once-more",
      category: "survival",
      rarity: "gold",
      name: "再来一次",
      desc: "第一次死亡后立刻回满血量并消灭敌人，复活后技能失效",
      unique: true,
      apply(game) {
        Blessings.grant(game, "surv-once-more");
      }
    },
    {
      id: "surv-shield-wave",
      category: "survival",
      rarity: "blue",
      name: "护盾不息",
      desc: "每次出现新的怪物时获得20点护盾",
      unique: true,
      apply(game) {
        Blessings.grant(game, "surv-shield-wave");
      }
    },
    {
      id: "surv-dodge",
      category: "survival",
      rarity: "blue",
      name: "闪避提升",
      desc: "闪避概率增加10%",
      apply(game) {
        game.stats.dodgeRate = Math.min(0.9, (game.stats.dodgeRate || 0) + 0.1);
      }
    },
    {
      id: "surv-fatal-guard",
      category: "survival",
      rarity: "purple",
      name: "续命术",
      desc: "可免疫一次致命攻击，使用后技能失效",
      note: "致命攻击：使血量降低到0点及以下的攻击",
      unique: true,
      apply(game) {
        Blessings.grant(game, "surv-fatal-guard");
      }
    },
    {
      id: "surv-shield-100",
      category: "survival",
      rarity: "purple",
      name: "盾来",
      desc: "获得100点护盾",
      apply(game) {
        if (typeof game.addShield === "function") game.addShield(100, null);
      }
    },
    {
      id: "surv-heal-white",
      category: "survival",
      rarity: "white",
      name: "生命恢复·白",
      desc: "生命增加10",
      apply(game) {
        game.stats.hp = Math.min(game.stats.maxHp, game.stats.hp + 10);
        if (typeof game.syncHpFromStats === "function") game.syncHpFromStats();
      }
    },
    {
      id: "surv-maxhp-white",
      category: "survival",
      rarity: "white",
      name: "上限突破·白",
      desc: "生命上限增加10",
      apply(game) {
        game.stats.maxHp += 10;
        if (typeof game.syncHpFromStats === "function") game.syncHpFromStats();
      }
    },
    {
      id: "surv-heal-blue",
      category: "survival",
      rarity: "blue",
      name: "生命恢复·蓝",
      desc: "生命增加50",
      apply(game) {
        game.stats.hp = Math.min(game.stats.maxHp, game.stats.hp + 50);
        if (typeof game.syncHpFromStats === "function") game.syncHpFromStats();
      }
    },
    {
      id: "surv-maxhp-blue",
      category: "survival",
      rarity: "blue",
      name: "上限突破·蓝",
      desc: "生命上限增加30",
      apply(game) {
        game.stats.maxHp += 30;
        if (typeof game.syncHpFromStats === "function") game.syncHpFromStats();
      }
    },
    {
      id: "surv-heal-purple",
      category: "survival",
      rarity: "purple",
      name: "生命恢复·紫",
      desc: "生命增加100",
      apply(game) {
        game.stats.hp = Math.min(game.stats.maxHp, game.stats.hp + 100);
        if (typeof game.syncHpFromStats === "function") game.syncHpFromStats();
      }
    },
    {
      id: "surv-maxhp-purple",
      category: "survival",
      rarity: "purple",
      name: "上限突破·紫",
      desc: "生命上限增加80",
      apply(game) {
        game.stats.maxHp += 80;
        if (typeof game.syncHpFromStats === "function") game.syncHpFromStats();
      }
    },

    // —— 攻击 ——
    {
      id: "atk-crit-rate-white",
      category: "attack",
      rarity: "white",
      name: "暴率",
      desc: "暴击率提升5%",
      apply(game) {
        game.stats.critRate = Math.min(0.95, (game.stats.critRate || 0) + 0.05);
      }
    },
    {
      id: "atk-crit-rate-blue",
      category: "attack",
      rarity: "blue",
      name: "暴率",
      desc: "暴击率提升10%",
      apply(game) {
        game.stats.critRate = Math.min(0.95, (game.stats.critRate || 0) + 0.1);
      }
    },
    {
      id: "atk-crit-rate-purple",
      category: "attack",
      rarity: "purple",
      name: "暴率",
      desc: "暴击率提升20%",
      apply(game) {
        game.stats.critRate = Math.min(0.95, (game.stats.critRate || 0) + 0.2);
      }
    },
    {
      id: "atk-crit-dmg-white",
      category: "attack",
      rarity: "white",
      name: "暴伤",
      desc: "暴击伤害提升10%",
      apply(game) {
        game.stats.critDmg = (game.stats.critDmg || 0) + 10;
      }
    },
    {
      id: "atk-crit-dmg-blue",
      category: "attack",
      rarity: "blue",
      name: "暴伤",
      desc: "暴击伤害提升20%",
      apply(game) {
        game.stats.critDmg = (game.stats.critDmg || 0) + 20;
      }
    },
    {
      id: "atk-crit-dmg-purple",
      category: "attack",
      rarity: "purple",
      name: "暴伤",
      desc: "暴击伤害提升40%",
      apply(game) {
        game.stats.critDmg = (game.stats.critDmg || 0) + 40;
      }
    },
    {
      id: "atk-spawn-min-white",
      category: "attack",
      rarity: "white",
      name: "数值提升",
      desc: "最小刷新数字变为4",
      apply(game) {
        Blessings.setMinSpawn(game, 4);
      }
    },
    {
      id: "atk-spawn-min-blue",
      category: "attack",
      rarity: "blue",
      name: "数值提升",
      desc: "最小刷新数字变为8",
      apply(game) {
        Blessings.setMinSpawn(game, 8);
      }
    },
    {
      id: "atk-spawn-min-purple",
      category: "attack",
      rarity: "purple",
      name: "数值提升",
      desc: "最小刷新数字变为16",
      apply(game) {
        Blessings.setMinSpawn(game, 16);
      }
    },
    {
      id: "atk-chain",
      category: "attack",
      rarity: "blue",
      name: "连消",
      desc: "结算伤害时有概率造成双倍伤害，连续合成的回合越多，概率越高",
      note: "连击：连续有合成的回合数；没合成的滑动或消除会清零",
      unique: true,
      apply(game) {
        Blessings.grant(game, "atk-chain");
      }
    },
    {
      id: "atk-fury",
      category: "attack",
      rarity: "purple",
      name: "怒火",
      desc: "生命上限锁定为50，但基础伤害变为3倍",
      unique: true,
      apply(game) {
        Blessings.grant(game, "atk-fury");
        Blessings.ensure(game).fury = true;
        game.stats.maxHp = 50;
        game.stats.hp = Math.min(game.stats.hp, 50);
        if (typeof game.syncHpFromStats === "function") game.syncHpFromStats();
      }
    },
    {
      id: "atk-leech",
      category: "attack",
      rarity: "blue",
      name: "汲取",
      desc: "敌方受到伤害时，回复伤害数值20%的生命值",
      note: "回复血量向上取整",
      unique: true,
      apply(game) {
        Blessings.grant(game, "atk-leech");
      }
    },
    {
      id: "atk-despair-blue",
      category: "attack",
      rarity: "blue",
      name: "绝处逢生",
      desc: "永久封锁两个格子（随机），所有怪物受到的伤害增加5%",
      note: "在最终伤害结算后再增加5%；与紫绝处逢生互斥",
      unique: true,
      exclusiveGroup: "despair",
      apply(game) {
        Blessings.grant(game, "atk-despair-blue");
        Blessings.banExclusivePeers(game, "atk-despair-blue");
        Blessings.lockRandomCells(game, 2);
        Blessings.addMonsterTakenBonus(game, 0.05);
      }
    },
    {
      id: "atk-despair-purple",
      category: "attack",
      rarity: "purple",
      name: "绝处逢生",
      desc: "永久封锁四个格子（分别是四个角落的格子），所有怪物受到的伤害增加10%",
      note: "在最终伤害结算后再增加10%；与蓝绝处逢生互斥",
      unique: true,
      exclusiveGroup: "despair",
      apply(game) {
        Blessings.grant(game, "atk-despair-purple");
        Blessings.banExclusivePeers(game, "atk-despair-purple");
        Blessings.lockCornerCells(game);
        Blessings.addMonsterTakenBonus(game, 0.1);
      }
    }
  ],

  createState() {
    return {
      owned: [],
      /** 互斥组里被永久屏蔽的祝福 id（如绝处逢生另一品质） */
      banned: [],
      /** 化风/化火/化土/化水：可叠加；结算只用这份列表，与格子颜色无关 */
      forceElements: [],
      /** 引燃：下一次攻击必定上灼烧 */
      pendingGuaranteedBurn: false,
      /** 一次性生存技能已使用 */
      consumed: [],
      /** 数值提升：最小生成数字 */
      minSpawnValue: 2,
      /** 怒火 */
      fury: false,
      /** 绝处逢生：怪物最终承伤加成（可叠加） */
      monsterTakenBonus: 0,
      /** 连续有合成的回合数（连消） */
      attackCombo: 0
    };
  },

  ensure(game) {
    if (!game.blessingState) game.blessingState = this.createState();
    const state = game.blessingState;
    if (!Array.isArray(state.owned)) state.owned = [];
    if (!Array.isArray(state.banned)) state.banned = [];
    if (!Array.isArray(state.forceElements)) state.forceElements = [];
    if (!Array.isArray(state.consumed)) state.consumed = [];
    // 兼容旧存档字段 forceElement
    if (state.forceElement && !state.forceElements.includes(state.forceElement)) {
      state.forceElements.push(state.forceElement);
    }
    state.forceElement = null;
    if (state.pendingGuaranteedBurn === undefined) state.pendingGuaranteedBurn = false;
    if (state.minSpawnValue == null) state.minSpawnValue = 2;
    if (state.fury == null) state.fury = false;
    if (state.monsterTakenBonus == null) state.monsterTakenBonus = 0;
    if (state.attackCombo == null) state.attackCombo = 0;
    return state;
  },

  isConsumed(game, id) {
    return this.ensure(game).consumed.includes(id);
  },

  consume(game, id) {
    const state = this.ensure(game);
    if (!state.consumed.includes(id)) state.consumed.push(id);
  },

  /** 仍有效（已拥有且未消耗） */
  isActive(game, id) {
    return this.has(game, id) && !this.isConsumed(game, id);
  },

  addForceElement(game, element) {
    const state = this.ensure(game);
    if (element && !state.forceElements.includes(element)) {
      state.forceElements.push(element);
    }
  },

  grant(game, id) {
    const state = this.ensure(game);
    if (!state.owned.includes(id)) state.owned.push(id);
  },

  has(game, id) {
    const state = this.ensure(game);
    return state.owned.includes(id);
  },

  /** 选中某祝福后，同互斥组的其它词条永久不再刷新 */
  banExclusivePeers(game, id) {
    const card = this.find(id);
    if (!card || !card.exclusiveGroup) return;
    const state = this.ensure(game);
    this.POOL.forEach((item) => {
      if (item.exclusiveGroup === card.exclusiveGroup && item.id !== id) {
        if (!state.banned.includes(item.id)) state.banned.push(item.id);
      }
    });
  },

  isBanned(game, id) {
    return this.ensure(game).banned.includes(id);
  },

  find(id) {
    return this.POOL.find((item) => item.id === id) || null;
  },

  byCategory(category) {
    return this.POOL.filter((item) => item.category === category);
  },

  /**
   * 三选一：从池中随机抽 3 张（稀有度可混色，不强制同色）。
   * - 已拥有的唯一祝福不再出现
   * - 互斥组（如绝处逢生蓝/紫）同屏最多一张；选中后另一张永久 banned
   */
  pickThree(game, category = "all") {
    const state = this.ensure(game);
    const owned = state.owned;
    const source =
      !category || category === "all" ? this.POOL.slice() : this.byCategory(category);
    const pool = source.filter((item) => {
      if (item.unique && owned.includes(item.id)) return false;
      if (state.banned.includes(item.id)) return false;
      return true;
    });
    const bag = pool.slice();
    const picked = [];
    const usedGroups = new Set();
    while (picked.length < 3 && bag.length) {
      const idx = Math.floor(Math.random() * bag.length);
      const card = bag.splice(idx, 1)[0];
      if (card.exclusiveGroup && usedGroups.has(card.exclusiveGroup)) continue;
      picked.push(card);
      if (card.exclusiveGroup) {
        usedGroups.add(card.exclusiveGroup);
        for (let i = bag.length - 1; i >= 0; i--) {
          if (bag[i].exclusiveGroup === card.exclusiveGroup) bag.splice(i, 1);
        }
      }
    }
    return picked;
  },

  applyChoice(game, id) {
    const card = this.find(id);
    if (!card) return;
    if (!game.stats) {
      const StatsLib =
        typeof Stats !== "undefined" ? Stats : require("./stats.js").Stats;
      game.stats = StatsLib.createPlayer();
    }
    this.ensure(game);
    card.apply(game);
    this.clampFuryMaxHp(game);
    if (typeof game.syncHpFromStats === "function") game.syncHpFromStats();
    if (!card.unique) this.grant(game, id);
  },

  /**
   * 本次「攻击属性」列表（可多种叠加）。
   * - 有任一「化X」时：只用强制元素列表，完全忽略格子上的元素
   * - 否则：用方块自身元素；白块（无元素）则无属性结算
   */
  resolveAttackElements(game, tileElement) {
    const state = this.ensure(game);
    if (state.forceElements.length) return state.forceElements.slice();
    if (tileElement) return [tileElement];
    return [];
  },

  /** @deprecated 兼容旧调用：多元素时返回结算选用的主元素 */
  resolveAttackElement(game, element) {
    const resolved = this.pickAttackSettlement(game, element, null);
    return resolved.attackElement || element;
  },

  /**
   * 多元素叠加时的一次伤害结算选用：
   * - 克制倍率取各元素中最有利的（压制可把火系优势提到 ×3）
   * - 元素加成用「提供该倍率」的那个元素
   */
  pickAttackSettlement(game, tileElement, defendElement) {
    const ElementsLib = typeof Elements !== "undefined" ? Elements : require("./elements.js").Elements;
    const list = this.resolveAttackElements(game, tileElement);
    if (!list.length) {
      return { attackElement: null, typeMult: 1, elements: [] };
    }
    let bestEl = list[0];
    let bestMult = 1;
    if (defendElement) {
      bestMult = this.resolveTypeMult(
        game,
        bestEl,
        ElementsLib.multiplier(bestEl, defendElement)
      );
      for (let i = 1; i < list.length; i += 1) {
        const el = list[i];
        const mult = this.resolveTypeMult(
          game,
          el,
          ElementsLib.multiplier(el, defendElement)
        );
        if (
          mult > bestMult ||
          (mult === bestMult &&
            this.elementBonusValue(game, el) > this.elementBonusValue(game, bestEl))
        ) {
          bestMult = mult;
          bestEl = el;
        }
      }
    }
    return { attackElement: bestEl, typeMult: bestMult, elements: list };
  },

  elementBonusValue(game, element) {
    if (!game.stats) return 100;
    return Stats.elementDmgBonusPct(game.stats, element);
  },

  /** 压制：火系优势时克制 ×3 */
  resolveTypeMult(game, attackElement, baseMult) {
    if (
      attackElement === "fire" &&
      baseMult === 2 &&
      this.has(game, "elem-fire-suppress")
    ) {
      return 3;
    }
    return baseMult;
  },

  /** 跃升：风方向合成后 1% 再翻倍 */
  rollWindAscent(game, swipeElement) {
    if (swipeElement !== "wind") return false;
    if (!this.has(game, "elem-wind-ascent")) return false;
    return Math.random() < 0.01;
  },

  /** 引燃：火方向合成后 1% 标记下次攻击必上灼烧 */
  rollFireIgnite(game, swipeElement) {
    if (swipeElement !== "fire") return false;
    if (!this.has(game, "elem-fire-ignite")) return false;
    if (Math.random() >= 0.01) return false;
    this.ensure(game).pendingGuaranteedBurn = true;
    return true;
  },

  /** 回响：攻击元素里含风时追加一次独立攻击 */
  shouldWindEcho(game, elements) {
    if (!this.has(game, "elem-wind-echo")) return false;
    const list = Array.isArray(elements) ? elements : [elements];
    return list.includes("wind");
  },

  /** 迟滞：攻击含土时 3% 让敌人等待次数 +1 */
  rollEarthDelay(game, elements) {
    if (!this.has(game, "elem-earth-delay")) return false;
    const list = Array.isArray(elements) ? elements : [elements];
    if (!list.includes("earth")) return false;
    return Math.random() < 0.03;
  },

  /** 滋生：水方向合成时 1% 在空位生成新块 */
  rollWaterSpawn(game, swipeElement) {
    if (swipeElement !== "water") return false;
    if (!this.has(game, "elem-water-spawn")) return false;
    return Math.random() < 0.01;
  },

  /** 回春：攻击含水时 3% 回 10 血 */
  rollWaterHeal(game, elements) {
    if (!this.has(game, "elem-water-heal")) return false;
    const list = Array.isArray(elements) ? elements : [elements];
    if (!list.includes("water")) return false;
    return Math.random() < 0.03;
  },

  applyWaterHeal(game) {
    if (!game.stats) return;
    game.stats.hp = Math.min(game.stats.maxHp, game.stats.hp + 10);
    if (typeof game.syncHpFromStats === "function") game.syncHpFromStats();
  },

  /**
   * 蓄伤：未在存储中时，15% 把本次伤害存起来（本下不结算）。
   * 返回 true 表示已存储、本次应跳过扣血。
   */
  tryStoreDamage(game, damage) {
    if (!this.has(game, "elem-water-store")) return false;
    if (game.storedDamage != null) return false;
    const value = Math.max(0, Math.floor(Number(damage) || 0));
    if (value <= 0) return false;
    if (Math.random() >= 0.15) return false;
    game.storedDamage = value;
    return true;
  },

  /** 取出并清空已存储伤害（没有则 0） */
  consumeStoredDamage(game) {
    const value = Math.max(0, Math.floor(Number(game.storedDamage) || 0));
    game.storedDamage = null;
    return value;
  },

  /** 蓄甲：土方向合成时，每次合成给 1 点无期限护盾 */
  grantEarthArmorShields(game, swipeElement, mergeCount) {
    if (swipeElement !== "earth") return;
    if (!this.has(game, "elem-earth-armor")) return;
    const n = Math.max(0, Math.floor(Number(mergeCount) || 0));
    for (let i = 0; i < n; i += 1) {
      if (typeof game.addShield === "function") game.addShield(1, null);
    }
  },

  /** 金身：挨打后生成 20 点、维持 3 行动的护盾 */
  grantGoldenBodyShield(game) {
    if (!this.has(game, "elem-earth-golden")) return;
    if (typeof game.addShield === "function") game.addShield(20, 3);
  },

  /** 轻身：5% 免疫 */
  rollLightBody(game) {
    if (!this.has(game, "elem-light-body")) return false;
    return Math.random() < 0.05;
  },

  /** 烙印：挨打后 3% 给敌人上灼烧 */
  rollFireBrand(game) {
    if (!this.has(game, "elem-fire-brand")) return false;
    return Math.random() < 0.03;
  },

  /**
   * 给目标上灼烧。who: "player" | "monster"
   * 灼烧规则：获得后到自己下一次攻击前，每行动一次扣 5 点体力。
   */
  applyBurnTo(game, who) {
    if (game && typeof game.applyBurn === "function") game.applyBurn(who);
  },

  /** 护盾不息：新怪出现时 +20 护盾 */
  onMonsterSpawn(game) {
    if (!this.has(game, "surv-shield-wave")) return;
    if (typeof game.addShield === "function") game.addShield(20, null);
  },

  /**
   * 续命术：本次伤害会把血量打到 ≤0 时，免疫并消耗技能。
   * currentHp / incoming 均为护盾结算后的扣血量。
   */
  tryFatalGuard(game, currentHp, incoming) {
    if (!this.isActive(game, "surv-fatal-guard")) return false;
    const hp = Math.max(0, Number(currentHp) || 0);
    const dmg = Math.max(0, Number(incoming) || 0);
    if (dmg <= 0 || dmg < hp) return false;
    this.consume(game, "surv-fatal-guard");
    return true;
  },

  /**
   * 再来一次：死亡时回满血并消灭当前敌人，然后失效。
   * 由 GameScene 负责具体回血/杀怪。
   */
  tryOnceMore(game) {
    if (!this.isActive(game, "surv-once-more")) return false;
    this.consume(game, "surv-once-more");
    return true;
  },

  setMinSpawn(game, value) {
    const state = this.ensure(game);
    state.minSpawnValue = Math.max(state.minSpawnValue || 2, value);
    game.minSpawnValue = state.minSpawnValue;
  },

  spawnValue(game) {
    const state = this.ensure(game);
    const min = Math.max(2, state.minSpawnValue || game.minSpawnValue || 2);
    return Math.random() < 0.9 ? min : min * 2;
  },

  resetAttackCombo(game) {
    this.ensure(game).attackCombo = 0;
  },

  /** 连消：每次结算连击 +1，概率 = min(60%, 连击数×8%) */
  rollChainDouble(game) {
    if (!this.has(game, "atk-chain")) return false;
    const state = this.ensure(game);
    state.attackCombo = (state.attackCombo || 0) + 1;
    const chance = Math.min(0.6, state.attackCombo * 0.08);
    return Math.random() < chance;
  },

  furyDamageMult(game) {
    return this.ensure(game).fury ? 3 : 1;
  },

  /** 怒火锁定上限 */
  clampFuryMaxHp(game) {
    if (!this.ensure(game).fury || !game.stats) return;
    game.stats.maxHp = 50;
    game.stats.hp = Math.min(game.stats.hp, 50);
  },

  /** 汲取：回复伤害 20% 向上取整 */
  applyLeech(game, dealt) {
    if (!this.has(game, "atk-leech") || !game.stats) return 0;
    const heal = Math.ceil(Math.max(0, Number(dealt) || 0) * 0.2);
    if (heal <= 0) return 0;
    game.stats.hp = Math.min(game.stats.maxHp, game.stats.hp + heal);
    if (typeof game.syncHpFromStats === "function") game.syncHpFromStats();
    return heal;
  },

  addMonsterTakenBonus(game, bonus) {
    const state = this.ensure(game);
    state.monsterTakenBonus = (state.monsterTakenBonus || 0) + bonus;
  },

  /** 最终伤害后再乘承伤加成 */
  applyMonsterTakenBonus(game, damage) {
    const bonus = this.ensure(game).monsterTakenBonus || 0;
    if (!bonus) return Math.max(0, Math.round(Number(damage) || 0));
    return Math.max(1, Math.round(Number(damage) * (1 + bonus)));
  },

  ensureExtraLocked(game) {
    if (!game.extraLocked) game.extraLocked = new Set();
    if (typeof GameEngine !== "undefined") GameEngine.extraLocked = game.extraLocked;
    return game.extraLocked;
  },

  lockRandomCells(game, count) {
    const locked = this.ensureExtraLocked(game);
    const { rows, cols } = this.boardSize();
    const candidates = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const key = `${row},${col}`;
        if (locked.has(key)) continue;
        candidates.push(key);
      }
    }
    let n = Math.min(count, candidates.length);
    while (n > 0 && candidates.length) {
      const idx = Math.floor(Math.random() * candidates.length);
      locked.add(candidates.splice(idx, 1)[0]);
      n -= 1;
    }
    if (typeof game.refreshLockedCells === "function") game.refreshLockedCells();
    if (typeof game.evacuateLockedTiles === "function") game.evacuateLockedTiles();
  },

  boardSize() {
    const engine =
      typeof GameEngine !== "undefined" ? GameEngine : require("./gameengine.js").GameEngine;
    return { rows: engine.ROWS, cols: engine.COLS };
  },

  lockCornerCells(game) {
    const locked = this.ensureExtraLocked(game);
    const { rows, cols } = this.boardSize();
    [
      [0, 0],
      [0, cols - 1],
      [rows - 1, 0],
      [rows - 1, cols - 1]
    ].forEach(([row, col]) => locked.add(`${row},${col}`));
    if (typeof game.refreshLockedCells === "function") game.refreshLockedCells();
    if (typeof game.evacuateLockedTiles === "function") game.evacuateLockedTiles();
  },

  /** 本次攻击是否应施加灼烧（引燃待触发） */
  consumeGuaranteedBurn(game) {
    const state = this.ensure(game);
    if (!state.pendingGuaranteedBurn) return false;
    state.pendingGuaranteedBurn = false;
    return true;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Blessings };
}

if (typeof window !== "undefined") {
  window.Blessings = Blessings;
}
