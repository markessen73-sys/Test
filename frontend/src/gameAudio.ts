import { assetUrl } from './assetUrl';

export type PunchSfxStation = 'heavy-bag' | 'speedball' | 'bobo-doll' | 'ring';
export type BackgroundMusicBed = 'gym' | 'bobo' | 'silent-film';

const MUSIC_BEDS: Record<BackgroundMusicBed, string> = {
  gym: assetUrl('/sounds/Boxing gym.mp3'),
  bobo: assetUrl('/sounds/slimeyfox-circus-di-primosole-beach-541357.mp3'),
  'silent-film': assetUrl('/sounds/drift_sound-piano-roll-for-silent-film-377316.mp3'),
};

const BACKGROUND_MUSIC_VOLUME = 0.18;
const BACKGROUND_MUSIC_PLAY_VOLUME = BACKGROUND_MUSIC_VOLUME * 0.5;
const BOBO_MUSIC_VOLUME = 0.22;
const SILENT_FILM_MUSIC_VOLUME = 0.2;

const PUNCH_SFX: Record<PunchSfxStation, string> = {
  'heavy-bag': assetUrl('/sounds/universfield-punch-03-352040.mp3'),
  speedball: assetUrl('/sounds/universfield-power-punch-192118.mp3'),
  'bobo-doll': assetUrl('/sounds/floraphonic-rubber-chicken-squeak-toy-1-181416.mp3'),
  ring: assetUrl('/sounds/beetpro-ouch-sound-effect-30-11844.mp3'),
};

/** Second bobo hit sound — randomly alternates with the squeak (unless chicken override). */
const BOBO_CLOWN_HORN_SFX = assetUrl('/sounds/freesound_community-clown-horn-44595.mp3');

/** Alternate “ough” for bag / speedball / ring with normal gloves. */
const GLOVE_OUGH_SFX = assetUrl('/sounds/freesound_community-ough-47202.mp3');

/** Skip encoder/file silence so impact aligns with the punch. */
const PUNCH_START_OFFSET: Record<PunchSfxStation, number> = {
  'heavy-bag': 0.29,
  speedball: 0.11,
  'bobo-doll': 0.03,
  ring: 0.08,
};

const BOBO_CLOWN_HORN_OFFSET = 0.02;
const GLOVE_OUGH_OFFSET = 0.02;

const GLOVE_OUGH_STATIONS: ReadonlySet<PunchSfxStation> = new Set([
  'heavy-bag',
  'speedball',
  'ring',
]);

let audioCtx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const bufferLoads = new Map<string, Promise<AudioBuffer>>();

let musicSource: AudioBufferSourceNode | null = null;
let musicGain: GainNode | null = null;
let musicPlaying = false;
let inPlayMode = false;
/** Station/context request (gym browse vs bobo play). */
let musicBed: BackgroundMusicBed = 'gym';
/** Glove-driven override — silent-film wins over gym/bobo while 1920s gloves are on. */
let musicBedOverride: BackgroundMusicBed | null = null;
let activeMusicSrc = MUSIC_BEDS.gym;
let musicSwitchToken = 0;
/** When set (e.g. rubber chicken), replaces station punch SFX. */
let punchSfxOverride: string | null = null;

function resolvedMusicBed(): BackgroundMusicBed {
  return musicBedOverride ?? musicBed;
}

function currentMusicVolume(): number {
  const bed = resolvedMusicBed();
  if (bed === 'silent-film') return SILENT_FILM_MUSIC_VOLUME;
  if (bed === 'bobo') return BOBO_MUSIC_VOLUME;
  return inPlayMode ? BACKGROUND_MUSIC_PLAY_VOLUME : BACKGROUND_MUSIC_VOLUME;
}

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function loadBuffer(src: string): Promise<AudioBuffer> {
  const cached = buffers.get(src);
  if (cached) return Promise.resolve(cached);

  const pending = bufferLoads.get(src);
  if (pending) return pending;

  const promise = fetch(src)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load audio: ${src}`);
      return res.arrayBuffer();
    })
    .then((data) => getAudioContext().decodeAudioData(data))
    .then((buffer) => {
      buffers.set(src, buffer);
      bufferLoads.delete(src);
      return buffer;
    })
    .catch((err) => {
      bufferLoads.delete(src);
      throw err;
    });

  bufferLoads.set(src, promise);
  return promise;
}

function updateMusicGain(): void {
  if (musicGain) musicGain.gain.value = currentMusicVolume();
}

function stopBackgroundMusic(): void {
  if (musicSource) {
    try {
      musicSource.stop();
    } catch {
      /* already stopped */
    }
    musicSource.disconnect();
    musicSource = null;
  }
  if (musicGain) {
    musicGain.disconnect();
    musicGain = null;
  }
  musicPlaying = false;
}

async function ensureBackgroundPlaying(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  if (musicPlaying && musicSource && musicGain) {
    updateMusicGain();
    return;
  }

  const token = musicSwitchToken;
  const src = activeMusicSrc;
  const buffer = await loadBuffer(src);
  if (token !== musicSwitchToken) return;
  if (musicPlaying && activeMusicSrc === src) return;

  stopBackgroundMusic();
  musicGain = ctx.createGain();
  musicGain.gain.value = currentMusicVolume();
  musicSource = ctx.createBufferSource();
  musicSource.buffer = buffer;
  musicSource.loop = true;
  musicSource.connect(musicGain);
  musicGain.connect(ctx.destination);
  musicSource.start(0);
  musicPlaying = true;
}

async function switchBackgroundMusic(src: string): Promise<void> {
  musicSwitchToken += 1;
  activeMusicSrc = src;
  stopBackgroundMusic();
  await ensureBackgroundPlaying();
}

/** Duck gym ambience while glove play is active (ignored for bobo bed). */
export function setBackgroundMusicPlayMode(active: boolean): void {
  inPlayMode = active;
  updateMusicGain();
}

/**
 * Swap looping ambience. Bobo play silences the gym bed and plays circus music;
 * leaving restores the gym loop. Respects glove overrides (1920s silent film).
 */
export function setBackgroundMusicBed(bed: BackgroundMusicBed): void {
  musicBed = bed;
  applyResolvedMusicBed();
}

/**
 * Glove-driven bed override. Pass `'silent-film'` for 1920s gloves, or `null` to
 * clear. Overrides gym and bobo beds while active.
 */
export function setBackgroundMusicBedOverride(bed: BackgroundMusicBed | null): void {
  musicBedOverride = bed;
  applyResolvedMusicBed();
}

function applyResolvedMusicBed(): void {
  const bed = resolvedMusicBed();
  const src = MUSIC_BEDS[bed];
  if (activeMusicSrc === src && musicPlaying) {
    updateMusicGain();
    return;
  }
  void switchBackgroundMusic(src).catch(() => {
    musicPlaying = false;
  });
}

/** Resume audio after autoplay blocks or tab backgrounding. */
export function unlockGameAudio(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  void ensureBackgroundPlaying().catch(() => {
    musicPlaying = false;
  });
  for (const src of Object.values(PUNCH_SFX)) {
    void loadBuffer(src).catch(() => {});
  }
  void loadBuffer(BOBO_CLOWN_HORN_SFX).catch(() => {});
  void loadBuffer(GLOVE_OUGH_SFX).catch(() => {});
  void loadBuffer(MUSIC_BEDS.bobo).catch(() => {});
  void loadBuffer(MUSIC_BEDS['silent-film']).catch(() => {});
  if (punchSfxOverride) void loadBuffer(punchSfxOverride).catch(() => {});
}

/** Override station punch sounds (rubber chicken uses one squeak on every target). */
export function setPunchSfxOverride(src: string | null): void {
  punchSfxOverride = src;
  if (src) void loadBuffer(src).catch(() => {});
}

export function preloadPunchSfx(station: PunchSfxStation): void {
  void loadBuffer(PUNCH_SFX[station]).catch(() => {});
  if (station === 'bobo-doll') void loadBuffer(BOBO_CLOWN_HORN_SFX).catch(() => {});
  if (GLOVE_OUGH_STATIONS.has(station)) void loadBuffer(GLOVE_OUGH_SFX).catch(() => {});
  if (punchSfxOverride) void loadBuffer(punchSfxOverride).catch(() => {});
}

function resolvePunchSfx(station: PunchSfxStation): { src: string; offset: number } {
  // Rubber chicken (and any future override) always wins — never alt hits.
  if (punchSfxOverride) {
    return { src: punchSfxOverride, offset: 0 };
  }
  if (station === 'bobo-doll' && Math.random() < 0.5) {
    return { src: BOBO_CLOWN_HORN_SFX, offset: BOBO_CLOWN_HORN_OFFSET };
  }
  if (GLOVE_OUGH_STATIONS.has(station) && Math.random() < 0.5) {
    return { src: GLOVE_OUGH_SFX, offset: GLOVE_OUGH_OFFSET };
  }
  return { src: PUNCH_SFX[station], offset: PUNCH_START_OFFSET[station] };
}

/** Play station punch sound (overlapping hits allowed). */
export function playPunchSfx(station: PunchSfxStation, volume = 0.85): void {
  const { src, offset } = resolvePunchSfx(station);
  const ctx = getAudioContext();

  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const playFromBuffer = (buffer: AudioBuffer) => {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0, offset);
  };

  const cached = buffers.get(src);
  if (cached) {
    playFromBuffer(cached);
    return;
  }

  void loadBuffer(src)
    .then(playFromBuffer)
    .catch(() => {});
}

/**
 * Synthesize a classic three-ring boxing bell (metallic ding with harmonics).
 * Higher-pitched, snappy rings — plays immediately when damage hits 100%.
 */
export function playBoxingBellSfx(volume = 0.75): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  const ringAt = (delaySec: number) => {
    const t0 = ctx.currentTime + delaySec;
    // Brighter / higher desk-bell partials
    const partials: Array<[number, number]> = [
      [1480, 0.55],
      [2220, 0.34],
      [2960, 0.22],
      [4440, 0.14],
      [5920, 0.08],
    ];
    for (const [freq, amp] of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      // Slight pitch drop as metal settles (short)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.98, t0 + 0.35);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(amp, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.48);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + 0.52);
    }
  };

  // Three quick rings — snappy end-of-round cadence
  ringAt(0);
  ringAt(0.26);
  ringAt(0.52);
}

/** @deprecated Use unlockGameAudio */
export function unlockPunchAudio(): void {
  unlockGameAudio();
}

/** @deprecated Use unlockGameAudio */
export function startBackgroundMusic(): void {
  unlockGameAudio();
}

/** @deprecated Use unlockGameAudio */
export function ensureBackgroundMusic(): void {
  unlockGameAudio();
}
