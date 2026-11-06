import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DONE_CLEAR_MS, DRUM, Flaps, MAX_FLIPS, SIDE, assignCodes, blockedReason, boardOrder, clockText, columnsOf, destinationOf, fitBoard, flightLine,
  flightNumber, flipPath, noteChanges, pageRows, pagesOf, plainText, readFlights, reasonLine, remarkOf, spaceCode,
} from "../mods/departures/logic.js";

const flight = (address, remark, extra = {}) => ({ address, remark, name: address, space: "lantern", code: "LN 204", since: 0, reason: null, ...extra });

test("each status has its remark", () => {
  assert.equal(remarkOf("working"), "BOARDING");
  assert.equal(remarkOf("blocked"), "DELAYED");
  assert.equal(remarkOf("done"), "DEPARTED");
  assert.equal(remarkOf("idle"), "AT GATE");
  assert.equal(remarkOf(null), "AT GATE");
});

test("a sub-agent is CONNECTING unless it's blocked", () => {
  for (const status of ["working", "idle", "done", null]) assert.equal(remarkOf(status, true), "CONNECTING");
  assert.equal(remarkOf("blocked", true), "DELAYED");
  assert.equal(remarkOf("error", true), "DELAYED");
});

test("the blocked reason comes from report.msg, then its kind", () => {
  assert.equal(blockedReason({ report: { msg: " approve Bash: ls " } }), "approve Bash: ls");
  assert.equal(blockedReason({ report: { kind: "question" } }), "has a question");
  assert.equal(blockedReason({ report: "plain words" }), "plain words");
  assert.equal(blockedReason({ status: "error" }), "stopped on an error");
  assert.equal(blockedReason(undefined), "waiting on you");
});

test("flap text is capitals from the drum", () => {
  assert.equal(plainText("Café  au_lait!"), "CAFE AU LAIT");
  assert.equal(plainText("⠂ fix login"), "FIX LOGIN");
  assert.equal(plainText(null), "");
  for (const ch of plainText("Any Text: 1/2 - it's #3 & more?")) assert.ok(DRUM.includes(ch));
});

test("a destination is a named tab, else the terminal's name, title or program", () => {
  const agent = { tab_name: "fix login", title: "shell", program: { name: "Agent" } };
  assert.equal(destinationOf(agent, { name: "worker" }), "FIX LOGIN");
  assert.equal(destinationOf({ ...agent, tab_name: "2" }, { name: "worker" }), "WORKER");
  assert.equal(destinationOf({ ...agent, tab_name: "2" }, null), "SHELL");
  assert.equal(destinationOf({ tab_name: "2", title: "⠂", program: { name: "Agent" } }, null), "AGENT");
});

test("space codes take two letters", () => {
  assert.equal(spaceCode("lantern"), "LN");
  assert.equal(spaceCode("harbor light"), "HL");
  assert.equal(spaceCode("api"), "AP");
  assert.equal(spaceCode("a"), "AX");
  assert.equal(spaceCode("~"), "XX");
});

test("a flight code stays with its agent and doesn't clash", () => {
  assert.equal(flightNumber("t7"), flightNumber("t7"));
  for (const address of ["t1", "t22", "vps/t7", ""]) {
    const n = flightNumber(address);
    assert.ok(n >= 100 && n <= 999);
  }
  const codes = {};
  const first = [{ address: "t1", space: "lantern" }];
  assert.equal(assignCodes(first, codes), true);
  const again = [{ address: "t1", space: "a new name" }];
  assert.equal(assignCodes(again, codes), false);
  assert.equal(again[0].code, first[0].code);

  const taken = { other: `LN ${flightNumber("t9")}` };
  const clash = [{ address: "t9", space: "lantern" }];
  assignCodes(clash, taken);
  assert.notEqual(clash[0].code, taken.other);
  assert.match(clash[0].code, /^LN \d{3}$/);
});

test("sub-agents come from the parent line, and a shell's child isn't one", () => {
  const list = [
    { address: "t1", pane: "p1", status: "working", tab_name: "fix login", space_name: "lantern" },
    { address: "t4", pane: "p4", status: "idle", tab_name: "kept", space_name: "orbit" },
  ];
  const all = [
    { address: "t1", state: "live", status: "working" },
    { address: "t2", state: "live", status: "working", parent: "t1", name: "review" },
    { address: "t3", state: "live", status: "blocked", parent: "t2", name: "deep", report: { msg: "approve read" } },
    { address: "t4", state: "live", status: "idle", parent: "t1" },
    { address: "t5", state: "finished", status: "done", parent: "t1", name: "gone" },
    { address: "t6", state: "live", status: "working", parent: "sh", name: "not ours" },
    { address: "sh", state: "live" },
  ];
  const flights = new Map(readFlights(list, all).map((f) => [f.address, f]));
  assert.deepEqual([...flights.keys()].sort(), ["t1", "t2", "t3", "t4"]);
  assert.equal(flights.get("t1").remark, "BOARDING");
  assert.equal(flights.get("t2").remark, "CONNECTING");
  assert.equal(flights.get("t2").space, "lantern");
  assert.equal(flights.get("t2").pane, null);
  assert.equal(flights.get("t3").remark, "DELAYED");
  assert.equal(flights.get("t3").reason, "approve read");
  assert.equal(flights.get("t4").remark, "CONNECTING");
  assert.equal(flights.get("t4").pane, "p4");
});

test("a loop of parents ends", () => {
  const all = [{ address: "a", parent: "b", state: "live" }, { address: "b", parent: "a", state: "live" }];
  assert.deepEqual(readFlights([], all), []);
});

test("time is when a flight took its remark", () => {
  const one = noteChanges({}, [{ address: "t1", remark: "BOARDING", stamp: null }], 1000);
  assert.equal(one.seen.t1.at, 1000);
  assert.equal(one.changed, true);
  const same = noteChanges(one.seen, [{ address: "t1", remark: "BOARDING", stamp: 1500 }], 2000);
  assert.equal(same.seen.t1.at, 1000);
  assert.equal(same.changed, false);
  const moved = noteChanges(same.seen, [{ address: "t1", remark: "DELAYED", stamp: 2500 }], 3000);
  assert.equal(moved.seen.t1.at, 2500);
  const ahead = noteChanges({}, [{ address: "t1", remark: "DELAYED", stamp: 9000 }], 3000);
  assert.equal(ahead.seen.t1.at, 3000);
});

test("an empty list forgets nobody", () => {
  const seen = { t1: { remark: "BOARDING", at: 1 } };
  assert.equal(noteChanges(seen, [], 5).seen, seen);
});

test("DELAYED floats to the top, oldest first, and done rows clear", () => {
  const now = DONE_CLEAR_MS * 3;
  const flights = [
    flight("idle", "AT GATE"), flight("board", "BOARDING"), flight("sub", "CONNECTING"), flight("left", "DEPARTED"),
    flight("gone", "DEPARTED"), flight("late", "DELAYED"), flight("later", "DELAYED"),
  ];
  const seen = {
    idle: { at: 1 }, board: { at: 2 }, sub: { at: 3 }, left: { at: now - DONE_CLEAR_MS + 1 }, gone: { at: now - DONE_CLEAR_MS },
    late: { at: 50 }, later: { at: 40 },
  };
  assert.deepEqual(boardOrder(flights, seen, now).map((f) => f.address), ["later", "late", "left", "board", "sub", "idle"]);
});

test("paging keeps every flight and every DELAYED row on each page", () => {
  const delayed = flight("d", "DELAYED", { reason: "why" });
  const others = Array.from({ length: 11 }, (_, i) => flight(`f${i}`, "BOARDING"));
  const pages = pagesOf([delayed, ...others], 8);
  assert.equal(pages.length, 2);
  for (const page of pages) {
    assert.equal(page[0], delayed);
    assert.ok(page.length + 1 <= 8);
  }
  assert.equal(new Set(pages.flat()).size, 12);
});

test("too many DELAYED rows take turns", () => {
  const flights = Array.from({ length: 6 }, (_, i) => flight(`d${i}`, "DELAYED", { reason: "why" }));
  const pages = pagesOf(flights, 4);
  assert.deepEqual(pages.map((p) => p.length), [2, 2, 2]);
});

test("one page when it all fits, and one for an empty board", () => {
  assert.equal(pagesOf([flight("a", "BOARDING")], 8).length, 1);
  assert.deepEqual(pagesOf([], 8), [[]]);
});

test("rows line up with the columns", () => {
  const shape = fitBoard(1440, 400);
  const since = new Date(2026, 5, 1, 9, 5).getTime();
  const line = flightLine(flight("t1", "DELAYED", { name: "a very long task name that won't fit", since, reason: "approve" }), shape.dest);
  assert.equal(line.length, shape.cells);
  const [time, code, dest, gate, remark] = columnsOf(shape.dest).map((c) => line.slice(c.start, c.start + c.width));
  assert.equal(time, "09:05");
  assert.equal(code, "LN 204");
  assert.equal(dest.trim(), "A VERY LONG TASK NAME".slice(0, shape.dest).trim());
  assert.equal(gate.trim(), "LANTERN");
  assert.equal(remark.trim(), "DELAYED");

  const reason = reasonLine(flight("t1", "DELAYED", { reason: "approve bash: ls" }), shape.dest);
  assert.equal(reason.length, shape.cells);
  assert.equal(reason.slice(0, 11).trim(), "");
  assert.equal(reason.slice(11).trim(), "APPROVE BASH: LS");
});

test("a page fills the board, with a second row for a reason", () => {
  const shape = fitBoard(1440, 400);
  const { lines, rows } = pageRows([flight("d", "DELAYED", { reason: "why" }), flight("b", "BOARDING")], shape);
  assert.equal(lines.length, shape.rows);
  assert.deepEqual(rows.slice(0, 4).map((r) => r.kind), ["flight", "reason", "flight", "blank"]);
  assert.equal(rows[1].flight, rows[0].flight);
  for (const line of lines) assert.equal(line.length, shape.cells);
});

test("an empty board reads NO DEPARTURES", () => {
  const shape = fitBoard(1440, 400);
  const { lines } = pageRows([], shape, true);
  assert.equal(lines.filter((l) => l.trim()).length, 1);
  const line = lines.find((l) => l.trim());
  assert.equal(line.trim(), "NO DEPARTURES");
  const dest = columnsOf(shape.dest)[2];
  assert.ok(line.slice(dest.start, dest.start + dest.width).includes("NO DEPARTURES")); // no gap runs through it
  assert.equal(pageRows([], fitBoard(1440, 90), true).lines[0].trim(), "NO DEPARTURES");
});

test("the type grows with the window and the letter count holds", () => {
  const small = fitBoard(900, 400), usual = fitBoard(1440, 400), big = fitBoard(1800, 500);
  for (const s of [small, usual, big]) assert.ok(s.dest >= 16 && s.dest <= 18);
  assert.ok(small.cell < usual.cell && usual.cell < big.cell);
  assert.ok(fitBoard(3000, 500).dest > 18);
  for (const width of [600, 900, 1200, 1440, 1728, 2560, 3800]) {
    const s = fitBoard(width, 400);
    assert.ok(s.cells * s.pitch + 4 * s.gap <= width - 2 * SIDE, `${width} fits`);
  }
  assert.equal(fitBoard(1440, usual.foldHeight).rows, 2);
  assert.equal(fitBoard(400, 20).rows, 1);
});

test("at a fractional zoom every grid size is whole pixels, so sums land on the cells", () => {
  for (const zoom of [1, 1.1, 1.2, 1.25, 1.5, 2]) {
    for (const width of [900, 1200, 1440, 1600]) {
      const s = fitBoard(width / zoom, 400, zoom);
      for (const key of ["pitch", "cell", "cellH", "half", "gap", "cellGap", "rowGap", "rowPitch"]) {
        const px = s[key] * zoom;
        assert.ok(Math.abs(px - Math.round(px)) < 0.01, `${key} at ${zoom} is ${px}px`);
        assert.equal(Math.round(px), Math.floor(px), `${key} at ${zoom} rounds and floors the same`);
      }
      assert.equal(Math.round(s.pitch * zoom), Math.round(s.cell * zoom) + Math.round(s.cellGap * zoom));
      if (width / zoom >= 600) assert.ok(s.cells * s.pitch + 4 * s.gap <= width / zoom - 2 * SIDE + 0.1, `${width} at ${zoom} fits`);
    }
  }
});

test("a folded board a pixel short still holds the flight and its reason", () => {
  for (const zoom of [1, 1.2, 1.5]) {
    const { foldHeight } = fitBoard(1200, 400, zoom);
    assert.equal(fitBoard(1200, foldHeight - 1, zoom).rows, 2, `at ${zoom}`);
  }
});

test("a cell is settled only once it has nothing left to fall", () => {
  const flaps = new Flaps(1, 6, ["AAAAAA"]);
  flaps.aim(["BBBBBB"]);
  assert.equal(flaps.settled(0, 5), false); // waiting for the wave
  flaps.tick();
  assert.equal(flaps.settled(0, 0), false); // falling
  flaps.tick();
  assert.equal(flaps.settled(0, 0), true);
  assert.equal(flaps.settled(0, 5), false);
  while (flaps.tick());
  assert.equal(flaps.settled(0, 5), true);
});

test("a flip goes forward and lands on the new letter", () => {
  assert.deepEqual(flipPath("A", "B"), ["B"]);
  assert.deepEqual(flipPath("A", "A"), []);
  assert.deepEqual(flipPath("A", "D"), ["B", "C", "D"]);
  assert.equal(flipPath(" ", "H").length, MAX_FLIPS);
  assert.deepEqual(flipPath(" ", "H"), ["D", "E", "F", "G", "H"]);
  assert.equal(flipPath("Z", "A").at(-1), "A");
  assert.equal(flipPath("B", "A").length, MAX_FLIPS);
  assert.deepEqual(flipPath("?", " "), [" "]);
});

test("flaps run left to right and stop", () => {
  const flaps = new Flaps(1, 6, ["AAAAAA"]);
  assert.equal(flaps.aim(["BBBBBB"]), 6);
  assert.equal(flaps.busy, true);
  flaps.tick();
  assert.deepEqual(flaps.at(0, 0), { top: "B", bottom: "A" }); // falling
  assert.deepEqual(flaps.at(0, 5), { top: "A", bottom: "A" }); // the wave isn't there yet
  flaps.tick();
  assert.deepEqual(flaps.at(0, 0), { top: "B", bottom: "B" });
  assert.equal(flaps.tick(), true);
  assert.equal(flaps.tick(), false); // the last cell waited two ticks, then took two
  assert.equal(flaps.busy, false);
  for (let c = 0; c < 6; c += 1) assert.deepEqual(flaps.at(0, c), { top: "B", bottom: "B" });
});

test("aiming at the same thing does nothing", () => {
  const flaps = new Flaps(1, 3, ["ABC"]);
  assert.equal(flaps.aim(["ABC"]), 0);
  assert.equal(flaps.busy, false);
});

test("only the changed row moves, and the rows below wait their turn", () => {
  const flaps = new Flaps(3, 2, ["AA", "AA", "AA"]);
  assert.equal(flaps.aim(["AA", "BB", "BB"]), 4);
  assert.equal(flaps.grid[0][0].wait, 0);
  assert.equal(flaps.grid[1][0].wait, 0);
  assert.equal(flaps.grid[2][0].wait, 1);
});

test("a new aim mid-flip still lands", () => {
  const flaps = new Flaps(1, 2);
  flaps.aim(["ZZ"]);
  flaps.tick();
  flaps.tick();
  flaps.tick();
  flaps.aim(["  "]);
  flaps.aim(["KL"]);
  for (let i = 0; i < 100 && flaps.tick(); i += 1);
  assert.equal(flaps.busy, false);
  assert.deepEqual(flaps.at(0, 0), { top: "K", bottom: "K" });
  assert.deepEqual(flaps.at(0, 1), { top: "L", bottom: "L" });
});

test("a burst is short whatever changes", () => {
  const shape = fitBoard(1440, 400);
  const flaps = new Flaps(shape.rows, shape.cells);
  flaps.aim(Array(shape.rows).fill("Z".repeat(shape.cells)));
  let ticks = 1;
  while (flaps.tick()) ticks += 1;
  assert.ok(ticks * 50 <= 2500, `${ticks} ticks`);
});

test("clock text is hours and minutes", () => {
  assert.equal(clockText(new Date(2026, 0, 1, 7, 3).getTime()), "07:03");
});
