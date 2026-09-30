/**
 * 方块刷新规律：什么时候刷、刷几块、刷在哪、刷出什么。方块本身的规则见 blocks.js。
 *
 * - 开局：刷 START_COUNT 块
 * - 每次有效滑动后：刷 PER_MOVE 块（滋生祝福触发时额外再刷 1 块）
 * - 使用方块（拖去攻击 / 加护盾）不会刷新
 * - 位置：随机一个可用空格
 * - 刷出的方块固定为 LEVEL 级，不带元素
 */
const BlockSpawn = {
  START_COUNT: 2,
  PER_MOVE: 1,
  LEVEL: 1,

  /**
   * 盘面上所有可放方块的空格。
   * @param {Array<{row:number,col:number,removed?:boolean}>} tiles 当前方块
   * @param {(row:number, col:number) => boolean} [isPlayable] 格子是否可用（被锁的格子返回 false）
   */
  emptyCells(tiles, rows, cols, isPlayable = () => true) {
    const taken = new Set(tiles.filter((tile) => !tile.removed).map((tile) => `${tile.row},${tile.col}`));
    const empties = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (isPlayable(row, col) && !taken.has(`${row},${col}`)) empties.push({ row, col });
      }
    }
    return empties;
  },

  /** 决定下一块刷在哪、刷几级（level 可指定）；没有空格返回 null */
  pick(tiles, rows, cols, options = {}) {
    const rng = options.rng || Math.random;
    const empties = this.emptyCells(tiles, rows, cols, options.isPlayable);
    if (!empties.length) return null;
    const spot = empties[Math.floor(rng() * empties.length)];
    return { row: spot.row, col: spot.col, level: options.level || this.LEVEL };
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BlockSpawn };
}
if (typeof window !== "undefined") window.BlockSpawn = BlockSpawn;
