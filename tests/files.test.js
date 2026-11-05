// The files themselves: no timers a mod doesn't have, a layout that fits the mod, a recipe in the gallery's order.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const mod = "mods/departures/";
const scripts = readdirSync(new URL(mod, root)).filter((f) => f.endsWith(".js"));

test("no mod file uses a timer that doesn't exist there", () => {
  for (const file of scripts) assert.doesNotMatch(read(mod + file), /\b(setTimeout|clearTimeout|setInterval|clearInterval|requestAnimationFrame)\b/, file);
});

test("the rules import nothing from the app", () => {
  assert.doesNotMatch(read(`${mod}logic.js`), /^import/m);
  assert.doesNotMatch(read(`${mod}demo.js`), /^import/m);
});

test("the sound is there, and a real MP3", () => {
  const bytes = readFileSync(new URL(`${mod}clack.mp3`, root));
  assert.ok(bytes.length > 500 && bytes.length < 20000);
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1] & 0xe0, 0xe0);
  assert.match(read(`${mod}main.js`), /"mods\/departures\/clack\.mp3"/);
});

test("the layout is main's window with the board on top", () => {
  const layout = JSON.parse(read("layouts/departures.json"));
  const nodes = new Map();
  const visit = (node) => { nodes.set(node.id, node); (node.children ?? []).forEach(visit); };
  visit(layout);
  assert.equal(layout.cloned_from.name, "main");
  assert.equal(layout.type, "column");
  assert.equal(layout.children[0].id, "board");
  assert.equal(layout.children[0].content.mod, "departures");
  assert.equal(layout.children[0].size.px, 400);
  assert.match(read(`${mod}main.js`), /OPEN_PX = 400/);
  for (const id of ["sidebar", "spaces", "tabs", "main", "panel", "status"]) assert.ok(nodes.has(id), id);
  assert.equal(nodes.get("main").content.tab, "active");
  assert.equal(nodes.get("agents").hidden, true);
  assert.ok(existsSync(new URL(layout.preview, root)));
});

test("the recipe has its six parts in order", () => {
  const recipe = read("RECIPE.md");
  const heads = [...recipe.matchAll(/^#{1,2} (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(heads, ["Departures", "What you see", "How it behaves", "Built from", "Watch out", "Done when"]);
  assert.match(recipe, /!\[Departures\]\(preview\.png\)/);
});

test("the writing has no long dashes", () => {
  for (const file of ["RECIPE.md", "README.md", ...scripts.map((f) => mod + f)]) assert.doesNotMatch(read(file), /—/, file);
});
