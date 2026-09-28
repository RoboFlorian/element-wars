/**
 * 怪物数值曲线：每一波怪物的血量、伤害、出手间隔、名字。
 * 调数值只改这里的参数；诅咒对伤害 / 间隔的修正在 curses.js 里另算。
 *
 * n = 波次 - 1（第 1 波 n = 0）
 * - 血量       = HP.base + HP.linear × n + HP.quad × n²
 * - 伤害       = max(ATK.min, ATK.base + ATK.perWave × 波次)
 * - 出手间隔   = max(ACTIONS.min, ACTIONS.start - floor(n / ACTIONS.stepWaves))
 *               （玩家每过这么多个战斗回合，怪物出手一次）
 */
const Monsters = {
  NAMES: ["黑团团", "灰刺球", "暗影块", "墨晶兽", "白影王"],

  HP: { base: 20, linear: 24, quad: 4 },

  ATK: { base: 6, perWave: 2, min: 1 },

  ACTIONS: { start: 7, stepWaves: 2, min: 3 },

  waveIndex(wave) {
    return Math.max(0, Math.floor(Number(wave) || 1) - 1);
  },

  hpFor(wave) {
    const n = this.waveIndex(wave);
    return Math.round(this.HP.base + this.HP.linear * n + this.HP.quad * n * n);
  },

  damageFor(wave) {
    const w = this.waveIndex(wave) + 1;
    return Math.max(this.ATK.min, Math.round(this.ATK.base + this.ATK.perWave * w));
  },

  actionsFor(wave) {
    const n = this.waveIndex(wave);
    const step = Math.max(1, this.ACTIONS.stepWaves);
    return Math.max(this.ACTIONS.min, this.ACTIONS.start - Math.floor(n / step));
  },

  nameFor(wave) {
    return this.NAMES[this.waveIndex(wave) % this.NAMES.length];
  },

  statsFor(wave) {
    return {
      wave: this.waveIndex(wave) + 1,
      name: this.nameFor(wave),
      hp: this.hpFor(wave),
      damage: this.damageFor(wave),
      actions: this.actionsFor(wave)
    };
  },

  /** 预览一段波次的数值，调参时用：node -e "console.table(require('./js/monsters.js').Monsters.table(1, 15))" */
  table(from = 1, to = 15) {
    const rows = [];
    for (let wave = from; wave <= to; wave += 1) rows.push(this.statsFor(wave));
    return rows;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Monsters };
}

if (typeof window !== "undefined") {
  window.Monsters = Monsters;
}
