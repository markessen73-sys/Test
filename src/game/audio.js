const THEMES = {
  title: [
    ["C5", 1], ["G4", 1], ["A4", 1], ["C5", 1], ["D5", 1], ["E5", 1], ["C5", 2],
  ],
  game: [
    ["C4", 1], ["-", 1], ["G3", 1], ["C4", 1], ["D4", 1], ["-", 1], ["G4", 1], ["E4", 1],
  ],
  win: [
    ["G4", 1], ["C5", 1], ["E5", 1], ["G5", 2],
  ],
  lose: [
    ["C4", 1], ["B3", 1], ["A3", 1], ["G3", 2],
  ],
};

const NOTE_INDEX = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

function noteToFrequency(note) {
  if (note === "-") {
    return null;
  }

  const [, key, octaveValue] = note.match(/^([A-G]#?)(\d)$/) || [];
  if (!key) {
    return null;
  }

  const midi = 12 * (Number(octaveValue) + 1) + NOTE_INDEX[key];
  return 440 * 2 ** ((midi - 69) / 12);
}

export class AudioManager {
  constructor() {
    this.context = null;
    this.master = null;
    this.timer = null;
    this.currentTheme = null;
  }

  async ensureReady() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return false;
    }

    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = 0.06;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    return true;
  }

  stopTheme() {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.currentTheme = null;
  }

  async playTheme(name, loop = true) {
    if (this.currentTheme === name) {
      return;
    }

    const ready = await this.ensureReady();
    if (!ready) {
      return;
    }

    this.stopTheme();
    this.currentTheme = name;
    this.scheduleTheme(name, loop);
  }

  scheduleTheme(name, loop) {
    const notes = THEMES[name];
    if (!notes || !this.context || this.currentTheme !== name) {
      return;
    }

    let cursor = this.context.currentTime + 0.03;
    notes.forEach(([note, beats]) => {
      const frequency = noteToFrequency(note);
      const duration = beats * 0.15;
      if (frequency) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(frequency, cursor);
        gain.gain.setValueAtTime(0.0001, cursor);
        gain.gain.linearRampToValueAtTime(0.07, cursor + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(cursor);
        osc.stop(cursor + duration);
      }
      cursor += duration;
    });

    if (loop) {
      this.timer = window.setTimeout(() => this.scheduleTheme(name, loop), (cursor - this.context.currentTime) * 1000);
    }
  }

  async playSfx(kind) {
    const ready = await this.ensureReady();
    if (!ready) {
      return;
    }

    const spec = {
      tick: { start: 420, end: 520, duration: 0.08, type: "square" },
      pickup: { start: 520, end: 860, duration: 0.14, type: "triangle" },
      warp: { start: 240, end: 720, duration: 0.24, type: "sawtooth" },
      hit: { start: 180, end: 60, duration: 0.28, type: "square" },
      win: { start: 420, end: 1120, duration: 0.34, type: "square" },
    }[kind];

    if (!spec) {
      return;
    }

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime;
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.start, start);
    osc.frequency.linearRampToValueAtTime(spec.end, start + spec.duration);
    gain.gain.setValueAtTime(0.06, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + spec.duration);
  }
}
