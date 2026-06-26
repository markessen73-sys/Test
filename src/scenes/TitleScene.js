import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from "../game/constants";
import { GAME_TITLE } from "../game/levels";
import { InputManager } from "../game/input";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.black);
    this.inputManager = new InputManager(this);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 12, GAME_HEIGHT - 12, COLORS.navy, 1).setStrokeStyle(4, COLORS.cyan);
    this.add.text(GAME_WIDTH / 2, 24, GAME_TITLE, {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#6cf0ff",
      align: "center",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 58, "CLEAN-ROOM SPACE CAVERN RUN", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.add.text(40, 78, [
      "GUIDE THE SKIMMER THROUGH",
      "THREE TRAP-FILLED VAULT SCREENS.",
      "",
      "HANGAR  >  LIFT  >  CORE",
      "ONE HIT SENDS YOU BACK",
      "TO THE START SCREEN.",
    ].join("\n"), {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#ffef75",
    });

    this.add.text(40, 144, "AVOID CONTACT", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#72f28f",
    });

    this.touchLabel = this.add.text(40, 154, "", {
      fontFamily: "monospace",
      fontSize: "6px",
      color: "#ffffff",
    });

    this.startLabel = this.add.text(GAME_WIDTH / 2, 182, "PRESS ENTER OR TAP TO START", {
      fontFamily: "monospace",
      fontSize: "7px",
      color: "#ff8ecb",
    }).setOrigin(0.5);

    this.input.on("pointerdown", () => this.startGame());
    this.input.keyboard.once("keydown", () => this.game.globals.audio.unlock());
    this.input.keyboard.addKey("T").on("down", () => {
      const enabled = this.inputManager.toggleTouchPreference();
      this.touchLabel.setText(`TOUCH ${enabled ? "ON" : "OFF"}  T TO TOGGLE`);
    });

    this.touchLabel.setText(`TOUCH ${this.inputManager.touchEnabled ? "ON" : "OFF"}  T TO TOGGLE`);
  }

  startGame() {
    this.game.globals.audio.unlock();
    this.scene.start("game", {
      score: 0,
      lives: 4,
      cycle: 1,
      hiScore: this.game.globals.hiScore,
    });
  }

  update() {
    const menu = this.inputManager.getMenuState();
    if (menu.start) {
      this.startGame();
    }

    this.startLabel.setVisible(Math.floor(this.time.now / 350) % 2 === 0);
  }
}
