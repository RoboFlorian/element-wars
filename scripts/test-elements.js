const { Elements } = require("../js/elements.js");

function assert(name, cond) {
  if (!cond) {
    console.error(`FAIL ${name}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok   ${name}`);
}

assert("water > fire x2", Elements.multiplier("water", "fire") === 2);
assert("fire > water x0.5", Elements.multiplier("fire", "water") === 0.5);
assert("fire > wind x2", Elements.multiplier("fire", "wind") === 2);
assert("wind > fire x0.5", Elements.multiplier("wind", "fire") === 0.5);
assert("wind > earth x2", Elements.multiplier("wind", "earth") === 2);
assert("earth > wind x0.5", Elements.multiplier("earth", "wind") === 0.5);
assert("earth > water x2", Elements.multiplier("earth", "water") === 2);
assert("water > earth x0.5", Elements.multiplier("water", "earth") === 0.5);
assert("same is x1", Elements.multiplier("fire", "fire") === 1);
assert("unrelated water/wind x1", Elements.multiplier("water", "wind") === 1);
assert("damage never zero", Elements.applyDamage(2, "fire", "water") === 1);
assert("damage x2", Elements.applyDamage(8, "water", "fire") === 16);
assert("up is wind", Elements.fromDir("up") === "wind");
assert("down is earth", Elements.fromDir("down") === "earth");
assert("left is water", Elements.fromDir("left") === "water");
assert("right is fire", Elements.fromDir("right") === "fire");
assert("merge keeps first", Elements.merge("fire", "water") === "fire");

if (!process.exitCode) console.log("all element tests passed");
