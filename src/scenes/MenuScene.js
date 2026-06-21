import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH, MENU_ITEMS } from "../game/constants";
import { loadGhost, loadScores, loadSettings, loadStats, saveSettings } from "../game/storage";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
    this.selection = 0;
    this.page = "main";
  }

  create() {
    this.settings = loadSettings();
    this.game.globals.settings = this.settings;
    this.game.globals.audio.updateSettings(this.settings);

    this.cameras.main.setBackgroundColor(COLORS.paper);
    this.input.keyboard.once("keydown", () => this.game.globals.audio.playSong("title"));
    this.input.once("pointerdown", () => this.game.globals.audio.playSong("title"));

    this.cursorKeys = this.input.keyboard.createCursorKeys();
    this.confirmKeys = this.input.keyboard.addKeys({ enter: "ENTER", space: "SPACE", esc: "ESC" });

    this.starField = Array.from({ length: 40 }, () =>
      this.add.rectangle(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT, 1, 1, Math.random() > 0.6 ? COLORS.cyan : COLORS.white),
    );

    this.titleText = this.add
      .text(GAME_WIDTH / 2, 24, "LUNAR\nMUSKMAN", {
        align: "center",
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#fff05a",
        stroke: "#ff4fd8",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);

    this.subtitleText = this.add
      .text(GAME_WIDTH / 2, 74, "ZX-STYLE RESCUE TO MARS", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#40e0d0",
      })
      .setOrigin(0.5);

    this.panel = this.add.rectangle(GAME_WIDTH / 2, 136, 212, 118, COLORS.ink, 0.92).setStrokeStyle(2, COLORS.magenta, 1);
    this.items = Array.from({ length: 6 }, (_, index) =>
      this.add
        .text(GAME_WIDTH / 2, 100 + index * 11, MENU_ITEMS[index] || "", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#f3f5ff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          this.selection = index;
          this.selectCurrent();
        }),
    );

    this.infoText = this.add
      .text(GAME_WIDTH / 2, 176, "ARROWS/ENTER OR TAP", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#4cff68",
      })
      .setOrigin(0.5);

    this.pageText = this.add
      .text(24, 102, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#f3f5ff",
        wordWrap: { width: 190 },
      })
      .setOrigin(0, 0);

    this.renderMain();
  }

  renderMain() {
    this.page = "main";
    this.selection = 0;
    this.pageText.setVisible(false);
    this.items.forEach((item, index) => {
      item.setVisible(index < MENU_ITEMS.length);
      item.setText(MENU_ITEMS[index] || "");
    });
    this.infoText.setText("ARROWS/ENTER OR TAP");
    this.updateHighlight();
  }

  renderScores() {
    this.page = "scores";
    const scores = loadScores();
    const stats = loadStats();
    this.items.forEach((item) => item.setVisible(false));
    const lines = ["TOP 20 SCORES"];
    if (scores.length === 0) {
      lines.push("", "NO RUNS LOGGED YET.");
    } else {
      scores.slice(0, 10).forEach((entry, index) => {
        const seconds = (entry.timeMs / 1000).toFixed(1).padStart(5, " ");
        lines.push(`${String(index + 1).padStart(2, "0")} ${entry.name.padEnd(4, " ")} ${String(entry.score).padStart(6, " ")} ${seconds}s`);
      });
    }
    lines.push("", `FASTEST LAUNCH ${stats.fastestLaunchMs ? `${(stats.fastestLaunchMs / 1000).toFixed(1)}s` : "--.--"}`);
    lines.push("", "ESC OR TAP TO RETURN");
    this.pageText.setVisible(true).setText(lines.join("\n"));
    this.infoText.setText("LOCAL STORAGE ARCHIVE");
  }

  renderSettings() {
    this.page = "settings";
    this.items.forEach((item, index) => {
      item.setVisible(index < 6);
      const labels = [
        `PILOT NAME ${this.settings.pilotName}`,
        `CRT ${this.settings.crt ? "ON" : "OFF"}`,
        `MUSIC ${this.settings.music ? "ON" : "OFF"}`,
        `SFX ${this.settings.sfx ? "ON" : "OFF"}`,
        `GHOST ${this.settings.ghostMode ? "ON" : "OFF"}`,
        `TOUCH ${this.settings.touchControls ? "ON" : "OFF"}`,
      ];
      item.setText(labels[index] || "");
    });
    this.pageText.setVisible(true).setText("COARSE POINTER DEVICES SHOW TOUCH BUTTONS.\nGHOST MODE REUSES YOUR FASTEST SAVED RUN.\n\nENTER TO TOGGLE.\nESC TO RETURN.");
    this.infoText.setText("SETTINGS");
    this.selection = 0;
    this.updateHighlight();
  }

  renderCredits() {
    this.page = "credits";
    this.items.forEach((item) => item.setVisible(false));
    this.pageText.setVisible(true).setText(
      [
        "ORIGINAL GAME BY CURSOR CLOUD AGENT",
        "",
        "CODE: MODULAR PHASER 3",
        "ART: GENERATED PIXEL TEXTURES",
        "AUDIO: SYNTH BEEPER SEQUENCES",
        "DESIGN: RANDOM LUNAR SURFACE",
        "",
        "INSPIRED BY 80S ARCADE FEEL",
        "ALL ASSETS ARE ORIGINAL.",
        "",
        "ESC OR TAP TO RETURN",
      ].join("\n"),
    );
    this.infoText.setText("CREDITS");
  }

  updateHighlight() {
    this.items.forEach((item, index) => {
      item.setStyle({ color: item.visible && index === this.selection ? "#fff05a" : "#f3f5ff" });
    });
  }

  changeSelection(delta) {
    const limit = this.page === "settings" ? 6 : MENU_ITEMS.length;
    this.selection = Phaser.Math.Wrap(this.selection + delta, 0, limit);
    this.updateHighlight();
  }

  selectCurrent() {
    if (this.page === "main") {
      const selected = MENU_ITEMS[this.selection];
      if (selected === "START GAME") {
        const ghostData = loadGhost();
        const useGhost = this.settings.ghostMode && ghostData;
        const challengeSeed = useGhost ? ghostData.challengeSeed : Math.floor(Math.random() * 0x7fffffff);
        this.scene.start("game", {
          level: 1,
          score: 0,
          challengeSeed,
          ghostData: useGhost ? ghostData : null,
        });
        return;
      }

      if (selected === "HIGH SCORES") {
        this.renderScores();
        return;
      }

      if (selected === "SETTINGS") {
        this.renderSettings();
        return;
      }

      this.renderCredits();
      return;
    }

    if (this.page === "settings") {
      if (this.selection === 0) {
        const response = window.prompt("Pilot name", this.settings.pilotName);
        if (response) {
          this.settings.pilotName = response.trim().slice(0, 4).toUpperCase() || "P1";
        }
      } else if (this.selection === 1) {
        this.settings.crt = !this.settings.crt;
      } else if (this.selection === 2) {
        this.settings.music = !this.settings.music;
      } else if (this.selection === 3) {
        this.settings.sfx = !this.settings.sfx;
      } else if (this.selection === 4) {
        this.settings.ghostMode = !this.settings.ghostMode;
      } else if (this.selection === 5) {
        this.settings.touchControls = !this.settings.touchControls;
      }

      saveSettings(this.settings);
      this.game.globals.settings = this.settings;
      this.game.globals.audio.updateSettings(this.settings);
      document.body.dataset.crt = this.settings.crt ? "true" : "false";
      this.renderSettings();
    }
  }

  handleBack() {
    this.renderMain();
  }

  update() {
    this.starField.forEach((star, index) => {
      star.x -= 0.2 + (index % 3) * 0.04;
      if (star.x < 0) {
        star.x = GAME_WIDTH;
      }
    });

    if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.up)) {
      this.changeSelection(-1);
    } else if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.down)) {
      this.changeSelection(1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.confirmKeys.enter) || Phaser.Input.Keyboard.JustDown(this.confirmKeys.space)) {
      this.selectCurrent();
    }

    if (Phaser.Input.Keyboard.JustDown(this.confirmKeys.esc) || this.input.activePointer.justDown) {
      if (this.page !== "main" && this.input.activePointer.justDown && this.pointerInPanel(this.input.activePointer)) {
        return;
      }
      if (this.page !== "main") {
        this.handleBack();
      }
    }
  }

  pointerInPanel(pointer) {
    return Phaser.Geom.Rectangle.Contains(this.panel.getBounds(), pointer.x, pointer.y);
  }
}
