import Phaser from "phaser";
import "./styles.css";
import { AudioManager } from "./game/audio";
import { GAME_HEIGHT, GAME_WIDTH } from "./game/constants";
import { loadSettings } from "./game/storage";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { LoadingScene } from "./scenes/LoadingScene";
import { MenuScene } from "./scenes/MenuScene";

const settings = loadSettings();
document.body.dataset.crt = settings.crt ? "true" : "false";

const globals = {
  settings,
  audio: new AudioManager(settings),
};

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  backgroundColor: "#08080f",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  callbacks: {
    postBoot: (game) => {
      game.globals = globals;
    },
  },
  scene: [BootScene, LoadingScene, MenuScene, GameScene],
};

window.addEventListener("load", () => {
  window.__LUNAR_MUSKMAN__ = new Phaser.Game(config);
});
