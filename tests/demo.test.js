import assert from "node:assert/strict";
import { test } from "node:test";
import { LOOP, demoWorld } from "../mods/departures/demo.js";
import { assignCodes, boardOrder, noteChanges, readFlights } from "../mods/departures/logic.js";

function story() {
  let seen = {};
  const codes = {};
  const steps = [];
  for (let step = 0; step < LOOP * 2; step += 1) {
    const { list, all, now } = demoWorld(step);
    const read = readFlights(list, all);
    seen = noteChanges(seen, read, now).seen;
    assignCodes(read, codes);
    steps.push(boardOrder(read, seen, now));
  }
  return steps;
}

test("it needs no agents and repeats exactly", () => {
  assert.deepEqual(demoWorld(3), demoWorld(3 + LOOP));
});

test("the story has every remark, with a reason on DELAYED", () => {
  const rows = story().flat();
  const remarks = new Set(rows.map((f) => f.remark));
  assert.deepEqual([...remarks].sort(), ["AT GATE", "BOARDING", "CONNECTING", "DELAYED", "DEPARTED"]);
  for (const f of rows.filter((r) => r.remark === "DELAYED")) assert.ok(f.reason && f.reason !== "waiting on you");
});

test("something changes on every step and a done row clears", () => {
  const steps = story();
  const reads = steps.map((flights) => flights.map((f) => `${f.address} ${f.remark}`).join());
  for (let i = 1; i < reads.length; i += 1) assert.notEqual(reads[i], reads[i - 1], `step ${i}`);
  assert.ok(new Set(steps.map((flights) => flights.length)).size > 1);
});

test("codes are all different", () => {
  const codes = {};
  const { list, all } = demoWorld(0);
  const read = readFlights(list, all);
  assignCodes(read, codes);
  assert.equal(new Set(read.map((f) => f.code)).size, read.length);
});
