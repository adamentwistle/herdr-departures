// Made-up flights for screenshots and GIFs, with `props: { demo: true }`. They take the same road as real
// agents: this fakes what agents() and terminals() would say, on a clock where one step is a minute. The story
// repeats every LOOP steps, and every step is worked out from its number, so a recording is the same every time.

export const DEMO_STEP_MS = 2000;
export const LOOP = 12;

const MINUTE = 60000;
const START = () => new Date(2026, 0, 1, 9, 41).getTime();

// `events`: [step, status, what it's waiting on]. Each flight's last event carries on round to its first.
// `age`: how many minutes before the story a flight with one event took it.
const FLIGHTS = [
  { id: "t1", space: "lantern", task: "Fix login loop", events: [[0, "working"], [3, "blocked", "approve bash: git push"], [7, "working"], [10, "done"]] },
  { id: "t2", space: "tidepool", task: "Port the parser", age: 47, events: [[0, "working"]] },
  { id: "t3", space: "tidepool", task: "Review tokens", age: 21, parent: "t2", events: [[0, "working"]] },
  { id: "t4", space: "orbit", task: "Speed up tests", events: [[1, "done"], [9, "working"]] },
  { id: "t5", space: "millpond", task: "Release notes", events: [[0, "idle"], [2, "working"], [8, "blocked", "has a question: keep old route?"], [11, "idle"]] },
  { id: "t6", space: "harbor light", task: "Rename routes", events: [[0, "working"], [5, "done"]] },
  { id: "t7", space: "tidepool", task: "Bisect a flake", parent: "t2", events: [[0, "working"], [6, "idle"]] },
  { id: "t8", space: "cobalt", task: "Trim the bundle", events: [[0, "idle"], [4, "working"], [10, "idle"]] },
  { id: "t9", space: "lantern", task: "Update lockfile", age: 63, events: [[0, "idle"]] },
  { id: "t10", space: "cobalt", task: "Draft new schema", events: [[0, "working"], [6, "idle"]] },
  { id: "t11", space: "millpond", task: "Clean up styles", age: 112, events: [[0, "idle"]] },
];

// The flight's event in force at this step of the story, and how many steps ago it began.
function eventAt(flight, step) {
  const past = flight.events.filter(([at]) => at <= step).at(-1);
  if (past) return { event: past, at: past[0] };
  const last = flight.events.at(-1);
  return { event: last, at: last[0] - LOOP };
}

// What the app would say at this step: { list, all, now }, as agents(), terminals() and the time.
export function demoWorld(step) {
  const place = ((step % LOOP) + LOOP) % LOOP;
  const now = START() + place * MINUTE;
  const list = [], all = [];
  for (const f of FLIGHTS) {
    const { event, at } = eventAt(f, place);
    const [, status, reason] = event;
    const stamp = f.events.length === 1 ? START() - (f.age ?? 0) * MINUTE : START() + at * MINUTE;
    all.push({
      address: f.id, name: f.task, parent: f.parent ?? null, state: "live", status,
      status_ms: stamp, report: reason ? { msg: reason } : null,
    });
    if (!f.parent) {
      list.push({
        address: f.id, pane: null, space: f.space, space_name: f.space, tab: f.id, tab_index: 1, tab_name: f.task,
        status, title: f.task, program: { name: "agent" },
      });
    }
  }
  return { list, all, now };
}
