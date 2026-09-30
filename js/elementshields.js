/**
 * 元素护盾：把元素方块拖到血条上获得，同元素、数值 = 方块数值。
 *
 * - 叠放顺序：列表按添加先后排列，最后加入的在最上面，怪物攻击时最先被打掉
 * - 同元素合并：再加一个已有元素的护盾，数值并入原护盾，并挪到最上面
 *   例：添加顺序 火→水→土→风（风最先挨打），再加火盾后变为 水→土→风→火（火最先挨打）
 * - 克制：怪物攻击元素克制护盾元素时，每 1 点伤害消耗 2 点护盾（10 点火盾挡 5 点水攻击就碎）；
 *   被护盾元素克制时，每 1 点伤害只消耗 0.5 点护盾。倍率同 Elements.multiplier
 * - 不带元素的护盾没有克制关系，1 点伤害消耗 1 点护盾
 */
const ElementShields = {
  /** 每个护盾：{ element: 元素 id 或 null, amount: 剩余数值 } */
  add(list, element, amount) {
    const value = Math.max(0, Number(amount) || 0);
    if (value <= 0) return list;
    const key = element || null;
    const index = list.findIndex((layer) => layer.element === key);
    let total = value;
    if (index >= 0) {
      total += list[index].amount;
      list.splice(index, 1);
    }
    list.push({ element: key, amount: total });
    return list;
  },

  /** 攻击元素打在护盾元素上，每 1 点伤害消耗几点护盾 */
  costPerDamage(attackElement, shieldElement) {
    if (!attackElement || !shieldElement) return 1;
    const ElementsLib = typeof Elements !== "undefined" ? Elements : require("./elements.js").Elements;
    return ElementsLib.multiplier(attackElement, shieldElement);
  },

  /**
   * 用护盾吸收一次攻击：从最上面（最后加入）的护盾开始消耗，打碎的护盾移除。
   * 直接修改 list，返回穿透护盾后剩下的伤害。
   */
  absorb(list, damage, attackElement) {
    let left = Math.max(0, Number(damage) || 0);
    while (left > 0 && list.length) {
      const layer = list[list.length - 1];
      const cost = this.costPerDamage(attackElement, layer.element);
      const capacity = layer.amount / cost;
      if (capacity > left) {
        layer.amount = this.round(layer.amount - left * cost);
        left = 0;
      } else {
        left = this.round(left - capacity);
        list.pop();
      }
    }
    return left;
  },

  total(list) {
    return this.round(list.reduce((sum, layer) => sum + layer.amount, 0));
  },

  /** 去掉浮点误差，保留两位小数 */
  round(value) {
    return Math.round(value * 100) / 100;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ElementShields };
}
if (typeof window !== "undefined") window.ElementShields = ElementShields;
