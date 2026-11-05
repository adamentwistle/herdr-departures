// Runs the mod with no app: a fake clock, fake timers and a render after each cx.notify().

import "./register.js";
import { host } from "./herdr.js";

const { default: Departures } = await import("../../mods/departures/main.js");

export { host };

export class Run {
  constructor({ now = new Date(2026, 5, 1, 10, 0, 30).getTime(), width = 1440, height = 400 } = {}) {
    this.now = now;
    this.timers = [];
    this.renders = 0;
    this.notified = false;
    this.realNow = Date.now;
    Date.now = () => this.now;
    globalThis.localStorage = this.storage();
    this.mod = new Departures();
    this.mod.init(host.props, this.cx());
    this.render();
    this.size(width, height);
  }

  storage() {
    const map = new Map();
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  }

  cx() {
    const add = (ms, fn, repeat) => {
      const timer = { at: this.now + ms, ms, fn, repeat };
      this.timers.push(timer);
      return { cancel: () => this.timers.splice(this.timers.indexOf(timer), 1), is_done: () => false };
    };
    return {
      notify: () => { this.notified = true; },
      stop_propagation() {},
      spawn: (body) => { body(this.cx()); return { cancel() {}, is_done: () => false }; },
      timer: { after: (ms, fn) => add(ms, fn, false), every: (ms, fn) => add(ms, fn, true) },
    };
  }

  render() {
    this.notified = false;
    this.renders += 1;
    this.tree = this.mod.render(this.cx());
    return this.tree;
  }

  size(width, height) {
    this.mod.resized({ width, height }, this.cx());
    this.render();
    this.settle();
  }

  // What the app does when its live data changes.
  changed() {
    this.render();
  }

  advance(ms) {
    const end = this.now + ms;
    for (;;) {
      const next = this.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      this.now = next.at;
      if (next.repeat) next.at += next.ms;
      else this.timers.splice(this.timers.indexOf(next), 1);
      next.fn(this.cx());
      if (this.notified) this.render();
    }
    this.now = end;
  }

  settle() {
    for (let i = 0; i < 400 && this.mod.ticking; i += 1) this.advance(50);
  }

  // The board as it reads now, one string per row.
  get lines() {
    return this.mod.flaps.grid.map((row) => row.map((cell) => cell.shown).join(""));
  }

  get oneShots() {
    return this.timers.filter((t) => !t.repeat).length;
  }

  stop() {
    Date.now = this.realNow;
    host.reset();
  }
}
