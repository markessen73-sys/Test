import Phaser from "phaser";
import "./styles.css";
import { AudioManager } from "./game/audio";
import { GAME_HEIGHT, GAME_WIDTH } from "./game/constants";
import { loadHiScore } from "./game/storage";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { TitleScene } from "./scenes/TitleScene";

const globals = {
  audio: new AudioManager(),
  hiScore: loadHiScore(),
};

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#000000",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  callbacks: {
    postBoot: (game) => {
      game.globals = globals;
    },
  },
  scene: [BootScene, TitleScene, GameScene],
};

window.addEventListener("load", () => {
  window.__STARVAULT_SKIMMER__ = new Phaser.Game(config);
});
