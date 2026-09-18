/**
 * 2048 的纯规则：只负责“这些方块往哪走、谁和谁合成”，不画界面。
 * 四个角落锁住，其余 12 格都能走。
 */
const ElementsLib = typeof Elements !== "undefined"
  ? Elements
  : require("./elements.js").Elements;

const GameEngine = {
  SIZE: 4,

  vectors: {
    left: { r: 0, c: -1 },
    right: { r: 0, c: 1 },
    up: { r: -1, c: 0 },
    down: { r: 1, c: 0 }
  },

  /** 只有四个角锁住 */
  isPlayable(row, col) {
    if (row < 0 || col < 0 || row >= this.SIZE || col >= this.SIZE) return false;
    const corner =
      (row === 0 && col === 0) ||
      (row === 0 && col === this.SIZE - 1) ||
      (row === this.SIZE - 1 && col === 0) ||
      (row === this.SIZE - 1 && col === this.SIZE - 1);
    return !corner;
  },

  inBounds(row, col) {
    return this.isPlayable(row, col);
  },

  playableCount() {
    return 12;
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

    const rows = [0, 1, 2, 3];
    const cols = [0, 1, 2, 3];
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
    const grid = Array.from({ length: this.SIZE }, () => Array(this.SIZE).fill(0));
    tiles.forEach((tile) => {
      if (!tile.removed) grid[tile.row][tile.col] = tile.value;
    });
    return grid;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { GameEngine };
}
