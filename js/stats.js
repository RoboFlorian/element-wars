/**
 * 玩家战斗属性（字段名按常见游戏开发习惯命名）。
 *
 * | 中文     | 字段            | 默认 | 说明 |
 * |----------|-----------------|------|------|
 * | 生命     | hp              | 100  | 当前生命 |
 * | 生命上限 | maxHp           | 100  | 生命上限 |
 * | 闪避     | dodgeRate       | 0    | 闪避率 0~1，每次挨打单独判定 |
 * | 防御     | dmgReduction    | 0    | 伤害减免 0~1；受伤 = 攻击 × (1 - dmgReduction) |
 * | 基础伤害 | atkPct          | 100  | 攻击百分比；100 = 方块数字原值 |
 * | 暴击率   | critRate        | 0    | 暴击率 0~1，只判定不乘算 |
 * | 暴击伤害 | critDmg         | 0    | 暴击伤害百分比；仅暴击且 >0 时乘入 |
 * | 火伤加成 | fireDmgBonus    | 100  | 火元素伤害加成百分比 |
 * | 水伤加成 | waterDmgBonus   | 100  | 水元素伤害加成百分比 |
 * | 土伤加成 | earthDmgBonus   | 100  | 土元素伤害加成百分比 |
 * | 风伤加成 | windDmgBonus    | 100  | 风元素伤害加成百分比 |
 *
 * 伤害公式：
 * - 无元素：最终 = 数值 × (atkPct/100) × 暴击项
 * - 有元素：最终 = (数值 × (atkPct/100) × (对应*DmgBonus/100) × 暴击项) × 克制倍率
 * - 暴击项：暴击且 critDmg>0 时为 critDmg/100，否则为 1；克制倍率最后乘
 */
const Stats = {
  createPlayer() {
    return {
      hp: 100,
      maxHp: 100,
      dodgeRate: 0,
      dmgReduction: 0,
      atkPct: 100,
      critRate: 0,
      critDmg: 0,
      fireDmgBonus: 100,
      waterDmgBonus: 100,
      earthDmgBonus: 100,
      windDmgBonus: 100
    };
  },

  elementDmgBonusPct(stats, element) {
    let value = 100;
    if (element === "fire") value = stats.fireDmgBonus;
    else if (element === "water") value = stats.waterDmgBonus;
    else if (element === "earth") value = stats.earthDmgBonus;
    else if (element === "wind") value = stats.windDmgBonus;
    if (value == null || !Number.isFinite(Number(value))) return 100;
    return Number(value);
  },

  rollAttack(tileValue, attack, defend, stats, rng = Math.random, options = {}) {
    const ElementsLib = typeof Elements !== "undefined" ? Elements : require("./elements.js").Elements;
    const atkPct = Number(stats.atkPct);
    const atkMult = (Number.isFinite(atkPct) ? atkPct : 100) / 100;
    let preType = Number(tileValue) * atkMult;

    const hasElement = Boolean(attack);
    let typeMult = 1;
    let elemBonusPct = 100;

    if (hasElement) {
      elemBonusPct = this.elementDmgBonusPct(stats, attack);
      typeMult = ElementsLib.multiplier(attack, defend);
      if (options && options.typeMultOverride != null) {
        typeMult = Number(options.typeMultOverride);
      }
      preType *= elemBonusPct / 100;
    }

    const isCritRoll = rng() < (stats.critRate || 0);
    const critDmgPct = Number(stats.critDmg);
    let critMult = 1;
    if (isCritRoll && Number.isFinite(critDmgPct) && critDmgPct > 0) {
      critMult = critDmgPct / 100;
      preType *= critMult;
    }

    const finalAttack = hasElement ? preType * typeMult : preType;

    return {
      damage: Math.max(1, Math.round(finalAttack)),
      isCrit: isCritRoll && critDmgPct > 0,
      typeMult,
      bonusPct: elemBonusPct,
      hasElement,
      finalAttack
    };
  },

  takeHit(rawAttack, stats, rng = Math.random) {
    if (rng() < (stats.dodgeRate || 0)) {
      return { damage: 0, dodged: true };
    }
    const dr = Math.min(0.9, Math.max(0, stats.dmgReduction || 0));
    const damage = Math.max(1, Math.round(Number(rawAttack) * (1 - dr)));
    return { damage, dodged: false };
  },

  clampHp(stats) {
    stats.maxHp = Math.max(1, stats.maxHp);
    stats.hp = Math.max(0, Math.min(stats.maxHp, stats.hp));
    return stats;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Stats };
}
