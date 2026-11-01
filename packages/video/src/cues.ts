import { VO, type Line } from './script';

export type Cue = { start: number; end: number; text: string };

/** Spoken form to written form for subtitles. */
const display = (t: string) => t.replace('jantahr dot devshipit dot com', 'jantahr.devshipit.com').replace('fourteen-day', '14-day');

/** Seconds each line lasts. Measured from the voiceover files when they exist (public/audio/vo-durations.json). */
export type Durations = Record<string, number>;

/** Splits each voiceover line into short cues (up to 7 words, broken at commas and full stops) spread over its duration. */
export const buildCues = (durations: Durations, lines: Line[] = VO): Cue[] => {
  const cues: Cue[] = [];
  for (const l of lines) {
    const total = durations[l.id] ?? l.text.split(' ').length / 2.6;
    const words = display(l.text).split(' ');
    const groups: string[][] = [];
    let cur: string[] = [];
    for (const w of words) {
      cur.push(w);
      if (cur.length >= 7 || (/[,.]$/.test(w) && cur.length >= 3)) { groups.push(cur); cur = []; }
    }
    // a short tail joins the previous cue rather than flashing on its own
    if (cur.length && groups.length && cur.length < 3) groups[groups.length - 1].push(...cur);
    else if (cur.length) groups.push(cur);
    const n = words.length;
    let t = l.at;
    for (const g of groups) {
      const d = (g.length / n) * total;
      cues.push({ start: t, end: t + d, text: g.join(' ') });
      t += d;
    }
  }
  return cues;
};

const ts = (s: number) => {
  const ms = Math.round(s * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
export const toSrt = (cues: Cue[]) => cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join('\n');

