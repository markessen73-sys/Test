const CLEMENTINE_MELODY = [
  ["E4", 1], ["A4", 1], ["C5", 2], ["C5", 1], ["A4", 1], ["G4", 2],
  ["E4", 1], ["A4", 1], ["C5", 2], ["A4", 1], ["G4", 1], ["E4", 2],
  ["A4", 1], ["A4", 1], ["G4", 1], ["E4", 1], ["D4", 2], ["D4", 1], ["E4", 1],
  ["G4", 2], ["E4", 1], ["D4", 1], ["C4", 2],
];

const CLEMENTINE_BASS = [
  ["A2", 2], ["E3", 2], ["A2", 2], ["E3", 2],
  ["A2", 2], ["E3", 2], ["A2", 2], ["E3", 2],
  ["D3", 2], ["A2", 2], ["D3", 2], ["A2", 2],
  ["E3", 2], ["A2", 2], ["E3", 2], ["A2", 2],
];

const CLEMENTINE_CASH = [
  ["-", 1], ["E6", 0.5], ["A6", 0.5], ["-", 2],
  ["-", 1], ["E6", 0.5], ["A6", 0.5], ["-", 2],
  ["-", 1], ["D6", 0.5], ["G6", 0.5], ["-", 2],
  ["-", 1], ["E6", 0.5], ["A6", 0.5], ["-", 2],
];

const THEMES = {
  title: {
    tempo: 0.18,
    loop: true,
    tracks: [
      { patch: "horn", notes: CLEMENTINE_MELODY },
      { patch: "coin", notes: CLEMENTINE_CASH },
      { patch: "engine", notes: CLEMENTINE_BASS },
    ],
  },
  game: {
    tempo: 0.16,
    loop: true,
    tracks: [
      { patch: "horn", notes: CLEMENTINE_MELODY },
      { patch: "coin", notes: CLEMENTINE_CASH },
      { patch: "engine", notes: CLEMENTINE_BASS },
    ],
  },
  win: {
    tempo: 0.13,
    loop: false,
    tracks: [
      { patch: "coin", notes: [["E6", 0.5], ["A6", 0.5], ["C7", 1], ["A6", 0.5], ["E6", 0.5], ["A6", 1]] },
      { patch: "horn", notes: [["A4", 1], ["C5", 1], ["E5", 2], ["A5", 2]] },
    ],
  },
  lose: {
    tempo: 0.18,
    loop: false,
    tracks: [
      { patch: "brake", notes: [["E4", 1], ["D4", 1], ["C4", 2]] },
      { patch: "engine", notes: [["A2", 2], ["G2", 2]] },
    ],
  },
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
    const theme = THEMES[name];
    if (!theme || !this.context || this.currentTheme !== name) {
      return;
    }

    const startTime = this.context.currentTime + 0.03;
    let maxCursor = 0;

    theme.tracks.forEach((track) => {
      let cursor = 0;
      track.notes.forEach(([note, beats]) => {
        const duration = beats * theme.tempo;
        const frequency = noteToFrequency(note);
        if (frequency) {
          this.schedulePatchedTone(track.patch, frequency, startTime + cursor, duration);
        }
        cursor += duration;
      });
      maxCursor = Math.max(maxCursor, cursor);
    });

    if (loop && maxCursor > 0) {
      this.timer = window.setTimeout(() => this.scheduleTheme(name, loop), maxCursor * 1000);
    }
  }

  schedulePatchedTone(patch, frequency, start, duration) {
    const createVoice = (type, detune = 0) => {
      const osc = this.context.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      osc.detune.setValueAtTime(detune, start);
      return osc;
    };

    if (patch === "horn") {
      const gain = this.context.createGain();
      const main = createVoice("square", 0);
      const bright = createVoice("sawtooth", 8);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.035, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      main.connect(gain);
      bright.connect(gain);
      gain.connect(this.master);
      main.start(start);
      bright.start(start);
      main.stop(start + duration);
      bright.stop(start + duration);
      return;
    }

    if (patch === "coin") {
      const gain = this.context.createGain();
      const bell = createVoice("triangle");
      const ping = createVoice("square", 12);
      bell.frequency.linearRampToValueAtTime(frequency * 1.8, start + duration * 0.6);
      ping.frequency.linearRampToValueAtTime(frequency * 2.2, start + duration * 0.4);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.03, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      bell.connect(gain);
      ping.connect(gain);
      gain.connect(this.master);
      bell.start(start);
      ping.start(start);
      bell.stop(start + duration);
      ping.stop(start + duration * 0.8);
      return;
    }

    if (patch === "engine") {
      const gain = this.context.createGain();
      const low = createVoice("sawtooth", -6);
      const rumble = createVoice("triangle", 4);
      low.frequency.linearRampToValueAtTime(frequency * 0.8, start + duration * 0.5);
      rumble.frequency.linearRampToValueAtTime(frequency * 1.1, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.02, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      low.connect(gain);
      rumble.connect(gain);
      gain.connect(this.master);
      low.start(start);
      rumble.start(start);
      low.stop(start + duration);
      rumble.stop(start + duration);
      return;
    }

    if (patch === "brake") {
      const gain = this.context.createGain();
      const screech = createVoice("sawtooth");
      screech.frequency.linearRampToValueAtTime(Math.max(40, frequency * 0.3), start + duration);
      gain.gain.setValueAtTime(0.03, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      screech.connect(gain);
      gain.connect(this.master);
      screech.start(start);
      screech.stop(start + duration);
    }
  }

  async playSfx(kind) {
    const ready = await this.ensureReady();
    if (!ready) {
      return;
    }

    const spec = {
      tick: { start: 360, end: 520, duration: 0.08, type: "square" },
      pickup: { start: 620, end: 1080, duration: 0.16, type: "triangle" },
      warp: { start: 180, end: 840, duration: 0.28, type: "sawtooth" },
      hit: { start: 260, end: 48, duration: 0.34, type: "sawtooth" },
      win: { start: 420, end: 1320, duration: 0.4, type: "square" },
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
