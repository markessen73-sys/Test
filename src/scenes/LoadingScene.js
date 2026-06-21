import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from "../game/constants";

export class LoadingScene extends Phaser.Scene {
  constructor() {
    super("loading");
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.ink);

    const title = this.add
      .text(GAME_WIDTH / 2, 40, "LUNAR MUSKMAN", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#40e0d0",
      })
      .setOrigin(0.5);

    const loader = this.add.graphics();
    const bar = this.add.graphics();

    const status = this.add
      .text(GAME_WIDTH / 2, 94, "TAPE LOADER READY", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#fff05a",
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(GAME_WIDTH / 2, 150, "ORIGINAL CODE ART SOUND", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#f3f5ff",
      })
      .setOrigin(0.5);

    loader.lineStyle(2, COLORS.white, 1);
    loader.strokeRect(28, 108, 200, 16);

    let progress = 0;
    const timer = this.time.addEvent({
      delay: 36,
      repeat: 39,
      callback: () => {
        progress = Math.min(1, progress + 0.025);
        bar.clear();
        bar.fillStyle(progress > 0.66 ? COLORS.magenta : COLORS.cyan, 1);
        bar.fillRect(32, 112, 192 * progress, 8);
        title.setTint(progress > 0.5 ? COLORS.yellow : COLORS.cyan);
        status.setText(`LOADING BYTES ${Math.floor(progress * 100)}%`);

        if (progress >= 1) {
          const loadingScreen = document.getElementById("loading-screen");
          if (loadingScreen) {
            loadingScreen.dataset.hidden = "true";
          }
          hint.setText("PRESS ANY KEY IN TITLE SCREEN");
          timer.destroy();
          this.time.delayedCall(300, () => this.scene.start("menu"));
        }
      },
    });

    for (let y = 0; y < GAME_HEIGHT; y += 8) {
      this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH, 1, y % 16 === 0 ? COLORS.paper : COLORS.ink, 0.35);
    }
  }
}
