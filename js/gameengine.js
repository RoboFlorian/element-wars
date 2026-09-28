/**
 * 2048 的纯规则：只负责“这些方块往哪走、谁和谁合成”，不画界面。
 * 行列数可变（默认 4×4，界面按战斗盘区域大小调用 setSize）；
 * 仅祝福等机制可通过 extraLocked 封锁格子。
 */
const ElementsLib = typeof Elements !== "undefined"
  ? Elements
  : require("./elements.js").Elements;

const GameEngine = {
  ROWS: 4,
  COLS: 4,

  setSize(rows, cols) {
    this.ROWS = Math.max(1, Math.floor(rows));
    this.COLS = Math.max(1, Math.floor(cols));
  },

  vectors: {
    left: { r: 0, c: -1 },
    right: { r: 0, c: 1 },
    up: { r: -1, c: 0 },
    down: { r: 1, c: 0 }
  },

  /** 祝福等机制额外封锁的格子：Set<"row,col"> */
  extraLocked: null,
  /** 诅咒「封堵」冻结的格子：Set<"row,col">，换怪时清空 */
  curseFrozen: null,

  isPlayable(row, col) {
    if (row < 0 || col < 0 || row >= this.ROWS || col >= this.COLS) return false;
    if (this.extraLocked && this.extraLocked.has(`${row},${col}`)) return false;
    if (this.curseFrozen && this.curseFrozen.has(`${row},${col}`)) return false;
    return true;
  },

  playableCount() {
    let count = 0;
    for (let row = 0; row < this.ROWS; row += 1) {
      for (let col = 0; col < this.COLS; col += 1) {
        if (this.isPlayable(row, col)) count += 1;
      }
    }
    return count;
  },

  inBounds(row, col) {
    return this.isPlayable(row, col);
  },

  tileAt(tiles, row, col) {
    return tiles.find((tile) => !tile.removed && tile.row === row && tile.col === col);
  },

  findFarthest(tiles, row, col, vector) {
    let currentRow = row;
    let currentCol = col;
    let nextRow = row + vector.r;
    let nextCol = col + vector.c;

    while (this.inBounds(nextRow, nextCol) && !this.tileAt(tiles, nextRow, nextCol)) {
      currentRow = nextRow;
      currentCol = nextCol;
      nextRow += vector.r;
      nextCol += vector.c;
    }

    return { row: currentRow, col: currentCol, nextRow, nextCol };
  },

  move(inputTiles, dir) {
    const vector = this.vectors[dir];
    const tiles = inputTiles.map((tile) => ({
      id: tile.id,
      row: tile.row,
      col: tile.col,
      value: tile.value,
      // 原样带走元素，移动时绝不改；只有合成时才改
      element: tile.element,
      removed: false,
      merged: false,
      justMerged: false
    }));

    const rows = Array.from({ length: this.ROWS }, (_, i) => i);
    const cols = Array.from({ length: this.COLS }, (_, i) => i);
    if (dir === "right") cols.reverse();
    if (dir === "down") rows.reverse();

    let moved = false;
    let gained = 0;
    const hits = [];

    rows.forEach((row) => {
      cols.forEach((col) => {
        const tile = this.tileAt(tiles, row, col);
        if (!tile || !this.isPlayable(tile.row, tile.col)) return;

        const startRow = tile.row;
        const startCol = tile.col;
        const target = this.findFarthest(tiles, tile.row, tile.col, vector);
        const next = this.inBounds(target.nextRow, target.nextCol)
          ? this.tileAt(tiles, target.nextRow, target.nextCol)
          : null;

        if (next && next.value === tile.value && !next.merged) {
          const fromElement = tile.element;
          const toElement = next.element;
          tile.removed = true;
          tile.row = next.row;
          tile.col = next.col;
          next.value *= 2;
          // 属性由滑动方向在界面层统一覆盖；引擎里只先保留目标格
          next.element = toElement || fromElement;
          next.merged = true;
          next.justMerged = true;
          gained += next.value;
          hits.push(next.value);
          moved = true;
        } else if (target.row !== startRow || target.col !== startCol) {
          tile.row = target.row;
          tile.col = target.col;
          moved = true;
        }
      });
    });

    return { tiles, moved, gained, hits };
  },

  canMove(tiles) {
    const live = tiles.filter((tile) => !tile.removed && this.isPlayable(tile.row, tile.col));
    if (live.length < this.playableCount()) return true;
    for (const tile of live) {
      const neighbors = [
        [tile.row, tile.col + 1],
        [tile.row + 1, tile.col]
      ];
      for (const [row, col] of neighbors) {
        const other = this.inBounds(row, col) ? this.tileAt(live, row, col) : null;
        if (other && other.value === tile.value) return true;
      }
    }
    return false;
  },

  gridValues(tiles) {
    const grid = Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(0));
    tiles.forEach((tile) => {
      if (!tile.removed) grid[tile.row][tile.col] = tile.value;
    });
    return grid;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { GameEngine };
}
