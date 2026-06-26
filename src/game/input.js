import Phaser from "phaser";
import { loadTouchPreference, saveTouchPreference } from "./storage";

export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.touchEnabled = loadTouchPreference();
    this.touchState = {
      x: 0,
      y: 0,
      pause: false,
    };
    this.activeTouchId = null;
    this.stickOrigin = null;
    this.stickRadius = 42;

    this.keys = scene.input.keyboard.addKeys({
      left: "LEFT",
      right: "RIGHT",
      up: "UP",
      down: "DOWN",
      pause: "ESC",
      start: "ENTER",
    });

    this.shell = document.getElementById("game-shell");
    this.appRoot = document.getElementById("app");
    this.touchRoot = document.getElementById("touch-controls");
    this.stickLayer = document.getElementById("touch-stick-layer");
    this.renderTouchControls();
    this.attachThumbstick();
    this.refreshTouchVisibility();
  }

  renderTouchControls() {
    if (!this.touchRoot) {
      return;
    }

    this.touchRoot.innerHTML = "";
    const controls = [["pause"]];

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

  attachThumbstick() {
    if (!this.appRoot || !this.stickLayer) {
      return;
    }

    this.stickBase = document.createElement("div");
    this.stickBase.className = "touch-stick-base";
    this.stickBase.hidden = true;
    this.stickKnob = document.createElement("div");
    this.stickKnob.className = "touch-stick-knob";
    this.stickKnob.hidden = true;
    this.stickLayer.appendChild(this.stickBase);
    this.stickLayer.appendChild(this.stickKnob);

    const updateStickFromEvent = (event) => {
      if (this.activeTouchId !== event.pointerId || !this.stickOrigin) {
        return;
      }

      const localX = event.clientX;
      const localY = event.clientY;
      const dx = localX - this.stickOrigin.x;
      const dy = localY - this.stickOrigin.y;
      const distance = Math.hypot(dx, dy);
      const clamped = distance > this.stickRadius ? this.stickRadius / distance : 1;
      const knobX = this.stickOrigin.x + dx * clamped;
      const knobY = this.stickOrigin.y + dy * clamped;
      const axisX = Math.abs(dx) < 8 ? 0 : Math.max(-1, Math.min(1, dx / this.stickRadius));
      const axisY = Math.abs(dy) < 8 ? 0 : Math.max(-1, Math.min(1, dy / this.stickRadius));

      this.touchState.x = axisX;
      this.touchState.y = axisY;
      this.stickKnob.style.left = `${knobX}px`;
      this.stickKnob.style.top = `${knobY}px`;
    };

    const clearStick = (event) => {
      if (this.activeTouchId !== event.pointerId) {
        return;
      }

      this.activeTouchId = null;
      this.stickOrigin = null;
      this.touchState.x = 0;
      this.touchState.y = 0;
      this.stickBase.hidden = true;
      this.stickKnob.hidden = true;
      document.body.releasePointerCapture?.(event.pointerId);
    };

    document.addEventListener("pointerdown", (event) => {
      if (!this.touchEnabled || !window.matchMedia("(pointer: coarse)").matches) {
        return;
      }
      if (this.activeTouchId !== null || event.pointerType === "mouse") {
        return;
      }
      if (event.target instanceof Element && event.target.closest("#touch-controls")) {
        return;
      }
      if (this.scene.scene.key !== "game") {
        return;
      }

      const localX = event.clientX;
      const localY = event.clientY;
      this.activeTouchId = event.pointerId;
      this.stickOrigin = { x: localX, y: localY };
      this.touchState.x = 0;
      this.touchState.y = 0;
      this.stickBase.hidden = false;
      this.stickKnob.hidden = false;
      this.stickBase.style.left = `${localX}px`;
      this.stickBase.style.top = `${localY}px`;
      this.stickKnob.style.left = `${localX}px`;
      this.stickKnob.style.top = `${localY}px`;
      event.preventDefault();
      document.body.setPointerCapture?.(event.pointerId);
      updateStickFromEvent(event);
    });

    document.addEventListener("pointermove", updateStickFromEvent);
    document.addEventListener("pointerup", clearStick);
    document.addEventListener("pointercancel", clearStick);
  }

  refreshTouchVisibility() {
    if (!this.shell) {
      return;
    }

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.shell.dataset.touch = this.touchEnabled && coarse ? "true" : "false";
    document.body.dataset.touch = this.touchEnabled && coarse ? "true" : "false";
  }

  toggleTouchPreference() {
    this.touchEnabled = !this.touchEnabled;
    saveTouchPreference(this.touchEnabled);
    this.refreshTouchVisibility();
    return this.touchEnabled;
  }

  getMenuState() {
    return {
      up: Phaser.Input.Keyboard.JustDown(this.keys.up),
      down: Phaser.Input.Keyboard.JustDown(this.keys.down),
      start: Phaser.Input.Keyboard.JustDown(this.keys.start) || this.touchState.pause,
    };
  }

  getPlayState() {
    const horizontal = (this.keys.left.isDown ? -1 : 0)
      + (this.keys.right.isDown ? 1 : 0);
    const vertical = (this.keys.up.isDown ? -1 : 0)
      + (this.keys.down.isDown ? 1 : 0);

    const touchX = this.touchState.x;
    const touchY = this.touchState.y;
    const useTouch = Math.abs(touchX) > 0.15 || Math.abs(touchY) > 0.15;

    if (useTouch) {
      if (Math.abs(touchX) >= Math.abs(touchY)) {
        return {
          x: Phaser.Math.Clamp(Math.sign(touchX), -1, 1),
          y: 0,
          pause: Phaser.Input.Keyboard.JustDown(this.keys.pause) || this.touchState.pause,
        };
      }

      return {
        x: 0,
        y: Phaser.Math.Clamp(Math.sign(touchY), -1, 1),
        pause: Phaser.Input.Keyboard.JustDown(this.keys.pause) || this.touchState.pause,
      };
    }

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
