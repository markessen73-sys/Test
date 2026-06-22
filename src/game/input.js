import Phaser from "phaser";
import { loadTouchPreference, saveTouchPreference } from "./storage";

export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.touchEnabled = loadTouchPreference();
    this.touchState = {
      left: false,
      right: false,
      up: false,
      down: false,
      pause: false,
    };

    this.keys = scene.input.keyboard.addKeys({
      left: "LEFT",
      right: "RIGHT",
      up: "UP",
      down: "DOWN",
      pause: "ESC",
      start: "ENTER",
    });

    this.shell = document.getElementById("game-shell");
    this.touchRoot = document.getElementById("touch-controls");
    this.renderTouchControls();
    this.refreshTouchVisibility();
  }

  renderTouchControls() {
    if (!this.touchRoot) {
      return;
    }

    this.touchRoot.innerHTML = "";
    const controls = [
      ["up"],
      ["left", "down", "right"],
      ["pause"],
    ];

    controls.forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "touch-row";
      row.forEach((control) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "touch-button";
        button.textContent = control.toUpperCase();
        button.dataset.control = control;

        const set = (value) => {
          this.touchState[control] = value;
        };

        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          set(true);
        });
        button.addEventListener("pointerup", (event) => {
          event.preventDefault();
          set(false);
        });
        button.addEventListener("pointerleave", () => set(false));
        button.addEventListener("pointercancel", () => set(false));
        rowEl.appendChild(button);
      });
      this.touchRoot.appendChild(rowEl);
    });
  }

  refreshTouchVisibility() {
    if (!this.shell) {
      return;
    }

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.shell.dataset.touch = this.touchEnabled && coarse ? "true" : "false";
  }

  toggleTouchPreference() {
    this.touchEnabled = !this.touchEnabled;
    saveTouchPreference(this.touchEnabled);
    this.refreshTouchVisibility();
    return this.touchEnabled;
  }

  getMenuState() {
    return {
      up: Phaser.Input.Keyboard.JustDown(this.keys.up) || this.touchState.up,
      down: Phaser.Input.Keyboard.JustDown(this.keys.down) || this.touchState.down,
      start: Phaser.Input.Keyboard.JustDown(this.keys.start) || this.touchState.pause,
    };
  }

  getPlayState() {
    const horizontal = (this.keys.left.isDown || this.touchState.left ? -1 : 0)
      + (this.keys.right.isDown || this.touchState.right ? 1 : 0);
    const vertical = (this.keys.up.isDown || this.touchState.up ? -1 : 0)
      + (this.keys.down.isDown || this.touchState.down ? 1 : 0);

    if (horizontal !== 0) {
      return {
        x: Phaser.Math.Clamp(horizontal, -1, 1),
        y: 0,
        pause: Phaser.Input.Keyboard.JustDown(this.keys.pause) || this.touchState.pause,
      };
    }

    return {
      x: 0,
      y: Phaser.Math.Clamp(vertical, -1, 1),
      pause: Phaser.Input.Keyboard.JustDown(this.keys.pause) || this.touchState.pause,
    };
  }
}
