/**
 * 元素系统：水火土风，以及它们互相打的时候伤害怎么加减。
 * 可以把它想成石头剪刀布：克制打 2 倍，被克制只打半倍，其他打 1 倍。
 * 格子属性由滑动方向决定：往哪滑，有数字的格子就变成对应元素。
 */
const Elements = {
  LIST: ["water", "fire", "earth", "wind"],

  META: {
    water: { id: "water", name: "水", short: "水", color: "#2f80ed" },
    fire: { id: "fire", name: "火", short: "火", color: "#eb5757" },
    earth: { id: "earth", name: "土", short: "土", color: "#f2c94c" },
    wind: { id: "wind", name: "风", short: "风", color: "#27ae60" }
  },

  /** 上下左右 → 风土水火 */
  DIR: {
    up: "wind",
    down: "earth",
    left: "water",
    right: "fire"
  },

  // 攻击方 → 被攻击方 → 倍率。没写的就是 1。
  TABLE: {
    water: { fire: 2, earth: 0.5 },
    fire: { water: 0.5, wind: 2 },
    earth: { water: 2, wind: 0.5 },
    wind: { fire: 0.5, earth: 2 }
  },

  random() {
    return this.LIST[Math.floor(Math.random() * this.LIST.length)];
  },

  fromDir(dir) {
    return this.DIR[dir] || this.LIST[0];
  },

  meta(id) {
    return this.META[id] || this.META.water;
  },

  /**
   * 合成只合数字；属性由滑动方向统一，这里只作兜底。
   */
  merge(a, b) {
    if (!a) return b;
    if (!b) return a;
    return a;
  },

  /**
   * 攻击元素打防守元素时的伤害倍率。至少按规则加减，不会变成 0。
   */
  multiplier(attack, defend) {
    const row = this.TABLE[attack] || {};
    const value = row[defend];
    return value == null ? 1 : value;
  },

  applyDamage(base, attack, defend) {
    const mult = this.multiplier(attack, defend);
    return Math.max(1, Math.round(base * mult));
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Elements };
}
