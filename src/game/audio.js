const CABARET_MELODY = [
  ["A4", 1], ["C5", 0.5], ["D5", 0.5], ["E5", 1], ["D5", 1], ["C5", 1], ["A4", 1], ["G4", 1],
  ["A4", 1], ["C5", 0.5], ["D5", 0.5], ["F5", 1], ["E5", 1], ["D5", 1], ["C5", 1], ["A4", 1],
  ["E5", 1], ["F5", 0.5], ["E5", 0.5], ["D5", 1], ["C5", 1], ["B4", 1], ["A4", 1], ["G4", 1],
  ["A4", 1], ["C5", 1], ["E5", 1], ["D5", 1], ["C5", 1], ["B4", 1], ["A4", 2],
];

const CABARET_BASS = [
  ["A2", 2], ["E3", 2], ["A2", 2], ["E3", 2],
  ["F3", 2], ["C3", 2], ["F3", 2], ["C3", 2],
  ["D3", 2], ["A2", 2], ["D3", 2], ["A2", 2],
  ["E3", 2], ["B2", 2], ["E3", 2], ["B2", 2],
];

const CABARET_CASH = [
  ["-", 0.5], ["E6", 0.25], ["A6", 0.25], ["-", 1], ["C7", 0.25], ["A6", 0.25], ["-", 1.5],
  ["-", 0.5], ["F6", 0.25], ["A6", 0.25], ["-", 1], ["D7", 0.25], ["A6", 0.25], ["-", 1.5],
  ["-", 0.5], ["E6", 0.25], ["G6", 0.25], ["-", 1], ["C7", 0.25], ["G6", 0.25], ["-", 1.5],
  ["-", 0.5], ["E6", 0.25], ["A6", 0.25], ["-", 1], ["C7", 0.25], ["A6", 0.25], ["-", 1.5],
];

const THEMES = {
  title: {
    tempo: 0.18,
    loop: true,
    tracks: [
      { patch: "horn", notes: CABARET_MELODY },
      { patch: "coin", notes: CABARET_CASH },
      { patch: "engine", notes: CABARET_BASS },
    ],
  },
  game: {
    tempo: 0.16,
    loop: true,
    tracks: [
      { patch: "horn", notes: CABARET_MELODY },
      { patch: "coin", notes: CABARET_CASH },
      { patch: "engine", notes: CABARET_BASS },
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

const MASTER_GAIN = 0.55;

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
    this.requestedTheme = null;
    this.requestedLoop = true;
    this.driveOsc = null;
    this.driveGain = null;
  }

  async ensureReady() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return false;
    }

    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = MASTER_GAIN;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch (error) {
        return false;
      }
    }

    return this.context.state === "running";
  }

  stopTheme() {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.currentTheme = null;
  }

  stopDriveDrone() {
    if (this.driveOsc) {
      try {
        this.driveOsc.stop();
      } catch (error) {
        // already stopped
      }
      this.driveOsc.disconnect();
      this.driveOsc = null;
    }
    if (this.driveGain) {
      this.driveGain.disconnect();
      this.driveGain = null;
    }
  }

  async setDriveActive(active, intensity = 0) {
    const ready = await this.ensureReady();
    if (!ready) {
      return;
    }

    if (!active) {
      if (this.driveGain) {
        const now = this.context.currentTime;
        this.driveGain.gain.cancelScheduledValues(now);
        this.driveGain.gain.setValueAtTime(this.driveGain.gain.value || 0.01, now);
        this.driveGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      }
      return;
    }

    if (!this.driveOsc) {
      this.driveOsc = this.context.createOscillator();
      this.driveOsc.type = "sawtooth";
      this.driveGain = this.context.createGain();
      this.driveGain.gain.value = 0.0001;
      this.driveOsc.connect(this.driveGain);
      this.driveGain.connect(this.master);
      this.driveOsc.start();
    }

    const now = this.context.currentTime;
    const targetGain = 0.02 + Math.min(0.05, intensity * 0.03);
    const targetFreq = 95 + Math.min(90, intensity * 45);
    this.driveOsc.frequency.cancelScheduledValues(now);
    this.driveOsc.frequency.linearRampToValueAtTime(targetFreq, now + 0.04);
    this.driveGain.gain.cancelScheduledValues(now);
    this.driveGain.gain.setValueAtTime(Math.max(0.0001, this.driveGain.gain.value || 0.0001), now);
    this.driveGain.gain.linearRampToValueAtTime(targetGain, now + 0.04);
  }

  async unlock() {
    const ready = await this.ensureReady();
    if (!ready || !this.requestedTheme) {
      return ready;
    }

    if (this.currentTheme !== this.requestedTheme || !this.timer) {
      this.stopTheme();
      this.currentTheme = this.requestedTheme;
      this.scheduleTheme(this.requestedTheme, this.requestedLoop);
    }

    return ready;
  }

  async playTheme(name, loop = true) {
    this.requestedTheme = name;
    this.requestedLoop = loop;

    if (this.currentTheme === name && this.timer) {
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
      gain.gain.linearRampToValueAtTime(0.08, start + 0.02);
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
      gain.gain.linearRampToValueAtTime(0.075, start + 0.01);
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
      gain.gain.linearRampToValueAtTime(0.055, start + 0.03);
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
      gain.gain.setValueAtTime(0.075, start);
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
      pickup: { start: 980, end: 640, duration: 0.09, type: "square" },
      warp: { start: 180, end: 840, duration: 0.28, type: "sawtooth" },
      hit: { start: 220, end: 40, duration: 0.42, type: "sawtooth" },
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
    gain.gain.setValueAtTime(0.12, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + spec.duration);
  }
}
