/**
 * 玩家角色等级与基础数值。目前只设计了 1 级。
 *
 * | 字段         | 1级  | 说明 |
 * |--------------|------|------|
 * | maxHp        | 100  | 生命上限（开局满血） |
 * | atkPct       | 100  | 伤害倍率；100 = 宝剑方块数值原样 |
 * | critRate     | 0.05 | 暴击率 5% |
 * | critDmg      | 150  | 暴击时伤害 ×1.5 |
 * | dodgeRate    | 0    | 闪避率 |
 * | dmgReduction | 0    | 伤害减免 |
 */
const PlayerLevels = {
  START_LEVEL: 1,
  LEVELS: {
    1: { maxHp: 100, atkPct: 100, critRate: 0.05, critDmg: 150, dodgeRate: 0, dmgReduction: 0 }
  },

  baseFor(level) {
    return this.LEVELS[level] || this.LEVELS[this.START_LEVEL];
  },

  /** 按等级生成一份满血的玩家属性 */
  createStats(level = this.START_LEVEL) {
    const StatsLib = typeof Stats !== "undefined" ? Stats : require("./stats.js").Stats;
    const stats = Object.assign(StatsLib.createPlayer(), this.baseFor(level));
    stats.hp = stats.maxHp;
    return stats;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PlayerLevels };
}
if (typeof window !== "undefined") window.PlayerLevels = PlayerLevels;
