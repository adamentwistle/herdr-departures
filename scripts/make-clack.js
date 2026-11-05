// Makes mods/departures/clack.mp3 from nothing but arithmetic: a soft double tap, like one flap landing on the next.
// Needs ffmpeg for the MP3. Run it with `node scripts/make-clack.js`. The same file comes out each time.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RATE = 44100;
const LENGTH = 0.14; // seconds
const out = fileURLToPath(new URL("../mods/departures/clack.mp3", import.meta.url));

// A little noise generator with a fixed start, so there's nothing random between runs.
let state = 20261105;
const noise = () => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 2147483648 - 1;
};

// One tap: a dull thump under a short tick of noise, smoothed so it isn't sharp.
function tap(buffer, at, level) {
  const start = Math.floor(at * RATE);
  let soft = 0;
  for (let i = start; i < buffer.length; i += 1) {
    const t = (i - start) / RATE;
    soft += 0.35 * (noise() - soft);
    const tick = soft * Math.exp(-t / 0.006);
    const thump = Math.sin(2 * Math.PI * 210 * t) * Math.exp(-t / 0.016);
    buffer[i] += level * (0.8 * tick + 0.55 * thump);
  }
}

const samples = new Float64Array(Math.floor(LENGTH * RATE));
tap(samples, 0.004, 0.32);
tap(samples, 0.046, 0.17);

const pcm = Buffer.alloc(samples.length * 2);
samples.forEach((value, i) => {
  const fade = Math.min(1, (samples.length - i) / (0.02 * RATE));
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value * fade)) * 32767), i * 2);
});

const made = spawnSync("ffmpeg", [
  "-y", "-loglevel", "error", "-f", "s16le", "-ar", String(RATE), "-ac", "1", "-i", "pipe:0",
  "-codec:a", "libmp3lame", "-b:a", "64k", "-map_metadata", "-1", "-id3v2_version", "0", "-write_xing", "0", out,
], { input: pcm, stdio: ["pipe", "inherit", "inherit"] });
if (made.status !== 0) throw new Error("ffmpeg failed");
console.log(`wrote ${out}`);
