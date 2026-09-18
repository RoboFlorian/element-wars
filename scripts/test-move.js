const { GameEngine } = require("../js/gameengine.js");

function tilesFromGrid(grid) {
  const tiles = [];
  let id = 1;
  grid.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value) tiles.push({ id: id++, row: r, col: c, value });
    });
  });
  return tiles;
}

function assertGrid(name, grid, dir, expected, expectedScore) {
  const result = GameEngine.move(tilesFromGrid(grid), dir);
  const actual = GameEngine.gridValues(result.tiles);
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same || (expectedScore !== undefined && result.gained !== expectedScore)) {
    console.error(`FAIL ${name}`);
    console.error(" actual", actual);
    console.error(" expect", expected);
    console.error(" score ", result.gained, "expect", expectedScore);
    process.exitCode = 1;
    return;
  }
  console.log(`ok   ${name}`);
}

assertGrid(
  "edge merge left",
  [
    [0, 0, 0, 0],
    [0, 2, 2, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  "left",
  [
    [0, 0, 0, 0],
    [4, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  4
);

assertGrid(
  "corners stay locked",
  [
    [0, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  "left",
  [
    [0, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  0
);

assertGrid(
  "two rows merge left to edge",
  [
    [0, 0, 0, 0],
    [0, 2, 2, 0],
    [0, 2, 2, 0],
    [0, 0, 0, 0]
  ],
  "left",
  [
    [0, 0, 0, 0],
    [4, 0, 0, 0],
    [4, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  8
);

assertGrid(
  "4 and 2 slide left without merging",
  [
    [0, 0, 0, 0],
    [0, 4, 2, 0],
    [0, 2, 0, 0],
    [0, 0, 0, 0]
  ],
  "left",
  [
    [0, 0, 0, 0],
    [4, 2, 0, 0],
    [2, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  0
);

assertGrid(
  "slide down to bottom edge",
  [
    [0, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 2, 0, 0],
    [0, 0, 0, 0]
  ],
  "down",
  [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 4, 0, 0]
  ],
  4
);

const full = tilesFromGrid([
  [0, 2, 4, 0],
  [8, 16, 32, 64],
  [128, 256, 512, 1024],
  [0, 2048, 4096, 0]
]);
if (GameEngine.canMove(full)) {
  console.error("FAIL full board without merges should be stuck");
  process.exitCode = 1;
} else {
  console.log("ok   full board stuck detection");
}

const open = tilesFromGrid([
  [0, 0, 0, 0],
  [0, 2, 0, 0],
  [0, 4, 0, 0],
  [0, 0, 0, 0]
]);
if (!GameEngine.canMove(open)) {
  console.error("FAIL open board should still move");
  process.exitCode = 1;
} else {
  console.log("ok   open board can move");
}

{
  const tiles = [
    { id: 1, row: 1, col: 2, value: 2, element: "fire" },
    { id: 2, row: 2, col: 1, value: 4, element: "wind" }
  ];
  const result = GameEngine.move(tiles, "left");
  const fire = result.tiles.find((t) => t.id === 1 && !t.removed);
  const wind = result.tiles.find((t) => t.id === 2 && !t.removed);
  if (!fire || fire.element !== "fire" || fire.value !== 2) {
    console.error("FAIL slide without merge must keep fire element", fire);
    process.exitCode = 1;
  } else if (!wind || wind.element !== "wind" || wind.value !== 4) {
    console.error("FAIL slide without merge must keep wind element", wind);
    process.exitCode = 1;
  } else {
    console.log("ok   slide keeps elements");
  }
}

{
  const tiles = [
    { id: 1, row: 1, col: 1, value: 2, element: "fire" },
    { id: 2, row: 1, col: 2, value: 2, element: "water" }
  ];
  const result = GameEngine.move(tiles, "left");
  const kept = result.tiles.find((t) => !t.removed);
  if (!kept || kept.value !== 4) {
    console.error("FAIL merge must double value", kept);
    process.exitCode = 1;
  } else {
    console.log("ok   merge doubles value");
  }
}

if (!GameEngine.isPlayable(0, 0) && GameEngine.isPlayable(0, 1) && GameEngine.playableCount() === 12) {
  console.log("ok   only corners locked");
} else {
  console.error("FAIL only corners should be locked");
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log("all move tests passed");
}
