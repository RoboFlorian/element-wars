/**
 * 方块规则：等级数值、合成条件。刷新规律见 blockspawn.js。
 *
 * - 所有方块都是元素方块：新刷出的方块不带元素，合成时获得元素（见 gamescene.js）
 * - 合成：同等级的两块合成一块，等级 +1（与元素无关）
 * - 数值：只由等级决定（valueFor）。拖到怪物身上 = 按数值攻击；拖到血条 = 获得同元素、同数值的护盾
 */
const Blocks = {
  NAME: "元素方块",
  /** 1 级方块的基础数值；每升一级翻倍：1级=2，2级=4，3级=8…… */
  BASE_VALUE: 2,

  valueFor(level) {
    const lv = Math.max(1, Math.floor(Number(level) || 1));
    return this.BASE_VALUE * 2 ** (lv - 1);
  },

  canMerge(a, b) {
    return Boolean(a && b) && a.level === b.level;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Blocks };
}
if (typeof window !== "undefined") window.Blocks = Blocks;
