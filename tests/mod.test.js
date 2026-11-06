// The mod itself, on a fake clock with no app: what it redraws, when it clacks, what a press does.

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DONE_CLEAR_MS, fitBoard } from "../mods/departures/logic.js";
import { Run, host } from "./stubs/runner.js";
import { callOf, walk } from "./stubs/gpui.js";

let run;
afterEach(() => { run?.stop(); run = null; });

const agent = (n, status, extra = {}) => ({
  address: `t${n}`, pane: `p${n}`, space: "s1", space_name: "lantern", tab: `b${n}`, tab_index: n, tab_name: `task ${n}`,
  status, title: "", program: { name: "agent" }, ...extra,
});
const term = (n, status, extra = {}) => ({ address: `t${n}`, state: "live", status, ...extra });

function board(n = 3) {
  host.agents = Array.from({ length: n }, (_, i) => agent(i + 1, "working"));
  host.terminals = Array.from({ length: n }, (_, i) => term(i + 1, "working"));
}

function press(id) {
  let found = null;
  walk(run.tree, (el) => { if (callOf(el, "id")?.[1] === id) found = el; });
  assert.ok(found, id);
  callOf(found, "on_click")[1]({}, run.cx());
}

test("an empty board reads NO DEPARTURES", () => {
  run = new Run();
  assert.equal(run.lines.filter((l) => l.trim()).map((l) => l.trim()).join(), "NO DEPARTURES");
});

test("a board with no changes redraws nothing", () => {
  board();
  run = new Run();
  const renders = run.renders;
  run.advance(9000);
  assert.equal(run.renders, renders);
  assert.equal(run.oneShots, 0);
  assert.equal(run.mod.ticking, false);
});

test("a status change flips, floats, clacks once and goes quiet", () => {
  board();
  run = new Run();
  assert.deepEqual(host.played, []); // filling the board isn't news
  host.agents[2].status = "blocked";
  host.terminals[2] = term(3, "blocked", { report: { msg: "approve bash: ls" } });
  run.changed();
  const before = run.renders;
  assert.equal(run.mod.ticking, true);
  run.changed();
  run.settle();
  assert.ok(run.renders - before > 10);
  assert.ok(run.renders - before < 60);
  assert.deepEqual(host.played, ["mods/departures/clack.mp3"]);
  assert.match(run.lines[0], /TASK 3/);
  assert.match(run.lines[0], /DELAYED/);
  assert.match(run.lines[1], /APPROVE BASH: LS/);
  const after = run.renders;
  run.advance(7000);
  assert.equal(run.renders, after);
});

test("the settings can silence it", () => {
  board();
  run = new Run();
  host.sounds = { enabled: false };
  host.agents[0].status = "idle";
  run.changed();
  run.settle();
  assert.deepEqual(host.played, []);
  assert.match(run.lines.join(), /AT GATE/);
});

test("two changes in one burst make one clack", () => {
  board();
  run = new Run();
  host.agents[0].status = "idle";
  run.changed();
  run.advance(100);
  host.agents[1].status = "idle";
  run.changed();
  run.settle();
  assert.equal(host.played.length, 1);
});

test("the next burst can clack again", () => {
  board();
  run = new Run();
  host.agents[0].status = "idle";
  run.changed();
  run.settle();
  run.advance(2000);
  host.agents[1].status = "idle";
  run.changed();
  run.settle();
  assert.equal(host.played.length, 2);
});

test("many agents page about every 8 seconds, without a clack", () => {
  board(12);
  run = new Run();
  const { rows } = fitBoard(1440, 400);
  assert.equal(run.mod.pages, 2);
  const first = run.lines.join("\n");
  run.advance(8100);
  run.settle();
  assert.notEqual(run.lines.join("\n"), first);
  assert.equal(run.mod.page, 1);
  assert.equal(run.lines.filter((l) => l.trim()).length, 12 - rows);
  assert.deepEqual(host.played, []);
});

test("one page never turns", () => {
  board(3);
  run = new Run();
  run.advance(9000);
  assert.equal(run.mod.page, 0);
});

test("the pointer on the board holds the page", () => {
  board(12);
  run = new Run();
  run.mod.onHover(true);
  run.advance(9000);
  assert.equal(run.mod.page, 0);
  run.mod.onHover(false);
  run.advance(9000);
  assert.equal(run.mod.page, 1);
});

test("a done row clears after a while, and the board says so", () => {
  host.agents = [agent(1, "done")];
  host.terminals = [term(1, "done")];
  run = new Run();
  assert.match(run.lines.join(), /DEPARTED/);
  run.advance(DONE_CLEAR_MS + 11000);
  run.settle();
  assert.equal(run.lines.filter((l) => l.trim()).map((l) => l.trim()).join(), "NO DEPARTURES");
});

test("pressing a row goes to that agent", () => {
  board(2);
  run = new Run();
  press("row-1");
  assert.deepEqual(host.ran, [["pane.focus", { pane: "p2" }]]);
});

test("pressing a sub-agent without a pane peeks at it", () => {
  host.agents = [agent(1, "idle")];
  host.terminals = [term(1, "idle"), term(2, "working", { parent: "t1", name: "review" })];
  run = new Run();
  const row = run.mod.rows.findIndex((r) => r.flight?.remark === "CONNECTING");
  press(`row-${row}`);
  assert.deepEqual(host.ran, [["terminal.peek", { terminal: "t2" }]]);
});

test("a press on a reason goes to its agent, and a blank row is no button", () => {
  host.agents = [agent(1, "blocked")];
  host.terminals = [term(1, "blocked", { report: { msg: "why" } })];
  run = new Run();
  press("row-1");
  assert.deepEqual(host.ran, [["pane.focus", { pane: "p1" }]]);
  assert.throws(() => press("row-2"));
});

test("the button folds the board to two rows and back", () => {
  board(2);
  run = new Run();
  const { foldHeight } = fitBoard(1440, 400);
  press("fold");
  assert.deepEqual(host.ran.at(-1), ["layout.resize", { id: "board", px: foldHeight }]);
  run.size(1440, foldHeight);
  assert.equal(run.lines.length, 2);
  press("fold");
  assert.deepEqual(host.ran.at(-1), ["layout.resize", { id: "board", px: 400 }]);
});

test("sizes are the app's own at any zoom", () => {
  host.zoom = 1.25;
  run = new Run({ width: 1800, height: 500 });
  assert.equal(run.lines[0].length, fitBoard(1440, 400, 1.25).cells);
  assert.equal(run.lines.length, fitBoard(1440, 400, 1.25).rows);
  // Whole pixels can move a letter between DESTINATION and the margin, or a row off the bottom, no more.
  assert.ok(Math.abs(run.lines[0].length - fitBoard(1440, 400).cells) <= 1);
  assert.ok(Math.abs(run.lines.length - fitBoard(1440, 400).rows) <= 1);
});

test("a resize snaps to the new shape without flipping", () => {
  board();
  run = new Run();
  run.mod.resized({ width: 1440, height: 600 }, run.cx());
  run.render();
  assert.equal(run.mod.flaps.busy, false);
  assert.match(run.lines[0], /BOARDING/);
  assert.deepEqual(host.played, []);
});

test("the agent keys follow the board", () => {
  host.agents = [agent(1, "working"), agent(2, "blocked")];
  host.terminals = [term(1, "working"), term(2, "blocked")];
  run = new Run();
  assert.deepEqual(host.order, ["t2", "t1"]);
});

test("demo mode runs with no agents and a press does nothing", () => {
  host.props = { demo: true };
  run = new Run();
  assert.equal(host.agents.length, 0);
  assert.match(run.lines.join(), /BOARDING/);
  let delayed = false;
  for (let i = 0; i < 12; i += 1) {
    run.advance(2000);
    run.settle();
    delayed ||= /DELAYED/.test(run.lines[0]);
  }
  assert.ok(delayed);
  press("row-0");
  assert.deepEqual(host.ran, []);
  assert.deepEqual(host.order, []);
});
