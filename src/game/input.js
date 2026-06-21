import Phaser from "phaser";

export class InputManager {
  constructor(scene, settings) {
    this.scene = scene;
    this.settings = settings;
    this.touchState = {
      left: false,
      right: false,
      thrust: false,
      beam: false,
      shield: false,
      pause: false,
    };

    this.keys = scene.input.keyboard.addKeys({
      left: "LEFT",
      right: "RIGHT",
      thrust: "UP",
      beam: "SPACE",
      shield: "SHIFT",
      pause: "ESC",
    });

    this.handleTouchVisibility();
    this.touchRoot = document.getElementById("touch-controls");
    this.attachTouchControls();
  }

  handleTouchVisibility() {
    const shell = document.getElementById("game-shell");
    if (!shell) {
      return;
    }

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    shell.dataset.touch = this.settings.touchControls && coarse ? "true" : "false";
  }

  attachTouchControls() {
    if (!this.touchRoot) {
      return;
    }

    this.touchRoot.innerHTML = "";
    const groups = [
      ["left", "right", "thrust"],
      ["beam", "shield", "pause"],
    ];

    groups.forEach((group, groupIndex) => {
      const wrap = document.createElement("div");
      wrap.className = "touch-group";
      group.forEach((name) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "touch-button";
        button.dataset.control = name;
        button.textContent = name.toUpperCase();

        const setState = (isDown) => {
          this.touchState[name] = isDown;
        };

        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          setState(true);
        });
        button.addEventListener("pointerup", (event) => {
          event.preventDefault();
          setState(false);
        });
        button.addEventListener("pointercancel", () => setState(false));
        button.addEventListener("pointerleave", () => setState(false));
        wrap.appendChild(button);
      });
      wrap.dataset.side = groupIndex === 0 ? "left" : "right";
      this.touchRoot.appendChild(wrap);
    });
  }

  updateSettings(settings) {
    this.settings = settings;
    this.handleTouchVisibility();
  }

  readGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && [...pads].find(Boolean);
    if (!pad) {
      return {
        left: false,
        right: false,
        thrust: false,
        beam: false,
        shield: false,
        pause: false,
      };
    }

    return {
      left: pad.axes[0] < -0.35 || pad.buttons[14]?.pressed,
      right: pad.axes[0] > 0.35 || pad.buttons[15]?.pressed,
      thrust: pad.buttons[0]?.pressed || pad.axes[1] < -0.45,
      beam: pad.buttons[2]?.pressed || pad.buttons[4]?.pressed,
      shield: pad.buttons[1]?.pressed || pad.buttons[5]?.pressed,
      pause: pad.buttons[9]?.pressed,
    };
  }

  getState() {
    const pad = this.readGamepad();
    return {
      left: this.keys.left.isDown || this.touchState.left || pad.left,
      right: this.keys.right.isDown || this.touchState.right || pad.right,
      thrust: this.keys.thrust.isDown || this.touchState.thrust || pad.thrust,
      beam: this.keys.beam.isDown || this.touchState.beam || pad.beam,
      shield: this.keys.shield.isDown || this.touchState.shield || pad.shield,
      pause: Phaser.Input.Keyboard.JustDown(this.keys.pause) || this.touchState.pause || pad.pause,
    };
  }

  destroy() {
    if (this.touchRoot) {
      this.touchRoot.innerHTML = "";
    }
  }
}
