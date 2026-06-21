const SONGS = {
  title: {
    tempo: 0.16,
    loop: true,
    notes: [
      ["C5", 1], ["G4", 1], ["A4", 1], ["G4", 1],
      ["E4", 1], ["G4", 1], ["C5", 1], ["D5", 1],
      ["G4", 1], ["A4", 1], ["C5", 1], ["A4", 1],
      ["F4", 1], ["G4", 1], ["A4", 1], ["C5", 2],
    ],
  },
  game: {
    tempo: 0.13,
    loop: true,
    notes: [
      ["C4", 1], ["-", 1], ["G3", 1], ["C4", 1],
      ["E4", 1], ["-", 1], ["G4", 1], ["E4", 1],
      ["F4", 1], ["-", 1], ["A4", 1], ["F4", 1],
      ["G4", 1], ["-", 1], ["B4", 1], ["G4", 1],
    ],
  },
  victory: {
    tempo: 0.14,
    loop: false,
    notes: [
      ["C5", 1], ["E5", 1], ["G5", 1], ["C6", 2],
      ["G5", 1], ["A5", 1], ["C6", 1], ["E6", 2],
      ["D6", 1], ["C6", 3],
    ],
  },
  gameOver: {
    tempo: 0.18,
    loop: false,
    notes: [
      ["C4", 1], ["B3", 1], ["A3", 1], ["G3", 2],
      ["F3", 1], ["E3", 1], ["D3", 2],
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

function frequencyForNote(note) {
  if (!note || note === "-") {
    return null;
  }

  const [, key, octaveText] = note.match(/^([A-G]#?)(\d)$/) || [];
  if (!key) {
    return null;
  }

  const octave = Number(octaveText);
  const midi = 12 * (octave + 1) + NOTE_INDEX[key];
  return 440 * (2 ** ((midi - 69) / 12));
}

export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.master = null;
    this.songTimer = null;
    this.songName = null;
  }

  updateSettings(settings) {
    this.settings = settings;
    if (!settings.music) {
      this.stopSong();
    }
  }

  async ensureReady() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return false;
    }

    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = 0.08;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    return true;
  }

  stopSong() {
    if (this.songTimer) {
      window.clearTimeout(this.songTimer);
      this.songTimer = null;
    }
    this.songName = null;
  }

  async playSong(name) {
    if (!this.settings.music || this.songName === name) {
      return;
    }

    const ready = await this.ensureReady();
    if (!ready || !SONGS[name]) {
      return;
    }

    this.stopSong();
    this.songName = name;
    this.scheduleSong(name, 0);
  }

  scheduleSong(name, startIndex) {
    if (!this.context || this.songName !== name) {
      return;
    }

    const song = SONGS[name];
    const startTime = this.context.currentTime + 0.02;
    let cursor = 0;

    for (let index = 0; index < song.notes.length; index += 1) {
      const [note, units] = song.notes[(startIndex + index) % song.notes.length];
      const duration = units * song.tempo;
      const frequency = frequencyForNote(note);

      if (frequency) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(frequency, startTime + cursor);
        gain.gain.setValueAtTime(0.0001, startTime + cursor);
        gain.gain.linearRampToValueAtTime(0.08, startTime + cursor + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + cursor + duration);
        oscillator.connect(gain);
        gain.connect(this.master);
        oscillator.start(startTime + cursor);
        oscillator.stop(startTime + cursor + duration);
      }

      cursor += duration;
    }

    if (song.loop) {
      this.songTimer = window.setTimeout(() => {
        this.scheduleSong(name, (startIndex + song.notes.length) % song.notes.length);
      }, cursor * 1000);
    } else {
      this.songTimer = window.setTimeout(() => {
        this.songTimer = null;
        this.songName = null;
      }, cursor * 1000);
    }
  }

  async playSfx(name) {
    if (!this.settings.sfx) {
      return;
    }

    const ready = await this.ensureReady();
    if (!ready) {
      return;
    }

    const specs = {
      thrust: { freq: 160, duration: 0.05, glide: 120, volume: 0.03, type: "square" },
      beam: { freq: 360, duration: 0.07, glide: 460, volume: 0.04, type: "sawtooth" },
      collect: { freq: 540, duration: 0.12, glide: 820, volume: 0.05, type: "square" },
      place: { freq: 280, duration: 0.14, glide: 520, volume: 0.05, type: "triangle" },
      explosion: { freq: 120, duration: 0.28, glide: 40, volume: 0.08, type: "sawtooth" },
      land: { freq: 220, duration: 0.12, glide: 180, volume: 0.04, type: "triangle" },
      power: { freq: 460, duration: 0.18, glide: 720, volume: 0.05, type: "square" },
      launch: { freq: 240, duration: 0.4, glide: 920, volume: 0.07, type: "square" },
    }[name];

    if (!specs) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime;
    oscillator.type = specs.type;
    oscillator.frequency.setValueAtTime(specs.freq, start);
    oscillator.frequency.linearRampToValueAtTime(specs.glide, start + specs.duration);
    gain.gain.setValueAtTime(specs.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + specs.duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + specs.duration);
  }
}
