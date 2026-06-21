# Lunar Muskman

Lunar Muskman is a browser game built with Phaser 3 and original code, art, and sound synthesis. It recreates the feel of a colorful ZX Spectrum-era rescue game with a responsive HTML5 canvas, local high-score storage, procedural terrain, touch support, gamepad input, and ghost racing data saved in the browser.

## Run locally

- `npm install`
- `npm run dev`
- `npm run build`

## Game flow

1. Start on the crash site.
2. Recover and place the five rocket parts.
3. Gather fuel pods after assembly.
4. Launch from the rocket pad.
5. Continue into harder worlds with stronger gravity and more enemies.

## File guide

- `index.html`  
  Browser shell for the canvas, retro loading overlay, and touch-controls mount point.

- `package.json`  
  Project metadata plus Vite build and preview scripts.

- `src/main.js`  
  Phaser bootstrap, responsive scale config, and shared globals such as settings and audio.

- `src/styles.css`  
  Responsive layout, CRT overlay styling, loading-screen visuals, and touch-control button styling.

- `src/game/constants.js`  
  Shared dimensions, palette, part definitions, enemy types, power-up types, and default settings.

- `src/game/storage.js`  
  Local-storage helpers for settings, top-20 scores, fastest launch stats, and saved ghost runs.

- `src/game/textures.js`  
  Procedurally generated pixel textures for the ship, ghost ship, rocket parts, enemies, power-ups, pads, and easter eggs.

- `src/game/audio.js`  
  Web Audio beeper music and retro sound effects for title, gameplay, victory, and game-over states.

- `src/game/input.js`  
  Keyboard, gamepad, and touch-input unification.

- `src/game/terrain.js`  
  Seeded procedural world generation for terrain, caves, pads, depots, spawns, and skyline decoration.

- `src/game/ghost.js`  
  Recording and playback utilities for racing against the best saved run.

- `src/scenes/BootScene.js`  
  Startup scene that generates textures and hands off to the loader.

- `src/scenes/LoadingScene.js`  
  Retro loading presentation before the main menu.

- `src/scenes/MenuScene.js`  
  Title screen, high scores, settings, and credits.

- `src/scenes/GameScene.js`  
  Core gameplay loop: flight physics, tractor beam, rocket assembly, fuel hauling, power-ups, enemies, scoring, pause/game-over/victory states, and ghost playback.