import Phaser from "phaser";
import { COLORS, EASTER_EGGS, ENEMY_TYPES, GAME_HEIGHT, GAME_WIDTH, PART_TYPES, POWER_UP_TYPES } from "../game/constants";
import { GhostPlayback, GhostRecorder } from "../game/ghost";
import { InputManager } from "../game/input";
import { generateWorld } from "../game/terrain";
import { loadSettings, loadStats, saveGhost, saveScore, saveStats } from "../game/storage";

function wrapAngleDegrees(angle) {
  return Phaser.Math.Angle.WrapDegrees(angle);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
}

function formatMeter(value) {
  return `${String(Math.floor(value)).padStart(3, "0")}`;
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
  }

  init(data) {
    this.level = data.level || 1;
    this.score = data.score || 0;
    this.challengeSeed = data.challengeSeed || Math.floor(Math.random() * 0x7fffffff);
    this.ghostData = data.ghostData || null;
    this.finalizedRun = false;
  }

  create() {
    this.settings = loadSettings();
    this.game.globals.settings = this.settings;
    document.body.dataset.crt = this.settings.crt ? "true" : "false";

    this.worldData = generateWorld(this.level, this.challengeSeed + this.level * 4099);
    this.cameras.main.setBackgroundColor(COLORS.paper);
    this.cameras.main.setBounds(0, 0, this.worldData.width, GAME_HEIGHT);

    this.drawSky();
    this.terrainGraphics = this.worldData.render(this);
    this.terrainGraphics.setDepth(5);

    this.addWorldMarkers();
    this.createRocketBlueprint();
    this.createObjects();
    this.createShip();
    this.createHud();
    this.createOverlays();

    this.cameras.main.startFollow(this.shipSprite, true, 0.08, 0.08);
    this.inputManager = new InputManager(this, this.settings);
    this.actionKeys = this.input.keyboard.addKeys({ enter: "ENTER", esc: "ESC" });
    this.recorder = new GhostRecorder();
    this.ghostPlayback = this.ghostData ? new GhostPlayback(this.ghostData.points) : null;

    if (this.ghostPlayback && this.settings.ghostMode) {
      this.ghostSprite = this.add.image(this.ship.x, this.ship.y, "ghostShip").setAlpha(0.4).setDepth(18);
    }

    this.beamGraphics = this.add.graphics().setDepth(25);
    this.effectText = this.add
      .text(128, 24, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#fff05a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(40);

    this.startTime = this.time.now;
    this.lastThrustTone = 0;
    this.pauseLatch = false;
    this.state = "playing";
    this.statusMessage = "RECOVER ROCKET PARTS";
    this.effects.invulnerableUntil = 6000;
    this.takeoffGraceUntil = 0;

    this.game.globals.audio.playSong("game");
  }

  drawSky() {
    this.skyGraphics = this.add.graphics().setDepth(1);
    this.skyGraphics.fillStyle(COLORS.ink, 1);
    this.skyGraphics.fillRect(0, 0, this.worldData.width, GAME_HEIGHT);
    this.worldData.skyline.forEach((star, index) => {
      const width = index % 4 === 0 ? 2 : 1;
      this.skyGraphics.fillStyle(star.brightness, 1);
      this.skyGraphics.fillRect(star.x, star.y, width, 1);
    });
  }

  addWorldMarkers() {
    this.padSprites = this.worldData.pads.map((pad) => {
      const texture = pad.kind === "fuelDepot" ? "fuelDepot" : "landingPad";
      const sprite = this.add.image(pad.x, pad.y - (pad.kind === "fuelDepot" ? 5 : 2), texture).setDepth(10);
      if (pad.kind === "assembly") {
        this.add
          .text(pad.x, pad.y - 18, "ROCKET PAD", {
            fontFamily: "monospace",
            fontSize: "7px",
            color: "#fff05a",
          })
          .setOrigin(0.5)
          .setDepth(11);
      }
      return sprite;
    });
  }

  createRocketBlueprint() {
    this.assemblySite = {
      x: this.worldData.assemblyPad.x,
      y: this.worldData.assemblyPad.y - 3,
    };

    const scale = this.worldData.rocketScale;
    const offsets = [
      { key: "base", x: 0, y: -10 * scale },
      { key: "engine", x: 0, y: 1 * scale },
      { key: "fuelTank", x: 0, y: -24 * scale },
      { key: "guidance", x: 0, y: -39 * scale },
      { key: "capsule", x: 0, y: -54 * scale },
    ];

    this.rocketSlots = offsets.map((offset) => {
      const sprite = this.add
        .image(this.assemblySite.x + offset.x, this.assemblySite.y + offset.y, "rocketSlot")
        .setScale(scale)
        .setDepth(14)
        .setTint(COLORS.cyan);
      this.add
        .text(this.assemblySite.x + offset.x + 12, this.assemblySite.y + offset.y - 4, offset.key.toUpperCase().slice(0, 3), {
          fontFamily: "monospace",
          fontSize: "6px",
          color: "#40e0d0",
        })
        .setDepth(14);
      return {
        ...offset,
        sprite,
        filled: false,
      };
    });

    this.rocketOutline = this.add.graphics().setDepth(13);
    this.rocketOutline.lineStyle(2, COLORS.magenta, 1);
    this.rocketOutline.strokeRect(
      this.assemblySite.x - 10 * scale,
      this.assemblySite.y - 62 * scale,
      20 * scale,
      72 * scale,
    );
  }

  createObjects() {
    this.parts = PART_TYPES.map((part, index) => {
      const spawn = this.worldData.partSpawns[index];
      const sprite = this.add.image(spawn.x, spawn.y, `part-${part.key}`).setDepth(15);
      return {
        kind: "part",
        key: part.key,
        label: part.label,
        score: part.score,
        x: spawn.x,
        y: spawn.y,
        sprite,
        marker: this.add
          .text(spawn.x, spawn.y - 14, part.label, {
            fontFamily: "monospace",
            fontSize: "6px",
            color: "#fff05a",
          })
          .setOrigin(0.5)
          .setDepth(16),
        placed: false,
        delivered: false,
        vx: 0,
        vy: 0,
      };
    });

    this.fuelPods = this.worldData.fuelSpawns.map((spawn) => {
      const sprite = this.add.image(spawn.x, spawn.y, "fuelPod").setDepth(15).setVisible(false);
      return {
        kind: "fuel",
        x: spawn.x,
        y: spawn.y,
        sprite,
        marker: this.add
          .text(spawn.x, spawn.y - 12, "FUEL", {
            fontFamily: "monospace",
            fontSize: "6px",
            color: "#4cff68",
          })
          .setOrigin(0.5)
          .setDepth(16)
          .setVisible(false),
        delivered: false,
      };
    });

    this.enemies = this.worldData.enemySpawns.map((spawn, index) => {
      const enemy = ENEMY_TYPES[index % ENEMY_TYPES.length];
      const safeSpawnX =
        Math.abs(spawn.x - this.worldData.assemblyPad.x) < 260
          ? spawn.x + 280 + index * 18
          : spawn.x;
      const clampedX = clamp(safeSpawnX, 80, this.worldData.width - 80);
      const sprite = this.add.image(clampedX, spawn.y, `enemy-${enemy.key}`).setDepth(17);
      return {
        ...enemy,
        x: clampedX,
        y: spawn.y,
        originX: clampedX,
        originY: spawn.y,
        dir: index % 2 === 0 ? 1 : -1,
        phase: index * 0.7,
        sprite,
        alive: true,
      };
    });

    this.powerUps = this.worldData.powerUpSpawns.map((spawn, index) => {
      const power = POWER_UP_TYPES[index % POWER_UP_TYPES.length];
      const sprite = this.add.image(spawn.x, spawn.y, `power-${power.key}`).setDepth(16);
      return {
        ...power,
        x: spawn.x,
        y: spawn.y,
        sprite,
        collected: false,
      };
    });

    this.easterEggs = this.worldData.eggSpawns.map((egg, index) => ({
      label: egg.label,
      x: egg.x,
      y: egg.y,
      sprite: this.add.image(egg.x, egg.y, `egg-${index}`).setDepth(12),
      found: false,
    }));

    this.progress = {
      stage: "assemble",
      partsPlaced: 0,
      fuelDelivered: 0,
      requiredFuel: this.fuelPods.length,
    };

    this.effects = {
      turboUntil: 0,
      beamUntil: 0,
      invulnerableUntil: 0,
    };
  }

  createShip() {
    const startX = this.worldData.assemblyPad.x;
    const startY = this.worldData.assemblyPad.y - 24;

    this.shipSprite = this.add.image(startX, startY, "ship").setDepth(20);
    this.shipSprite.setOrigin(0.5, 0.5);
    this.shipSprite.setRotation(0);

    this.ship = {
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      fuel: 100,
      shield: 100,
      lives: 4,
      carried: null,
      landedPad: this.worldData.assemblyPad,
    };

    this.shieldRing = this.add.circle(startX, startY, 11, COLORS.cyan, 0.22).setDepth(19).setVisible(false);
  }

  createHud() {
    this.hudText = this.add
      .text(8, 6, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#f3f5ff",
      })
      .setScrollFactor(0)
      .setDepth(40);

    this.hudRight = this.add
      .text(GAME_WIDTH - 8, 6, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        align: "right",
        color: "#40e0d0",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(40);

    this.messageText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 16, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#fff05a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(40);
  }

  createOverlays() {
    this.overlayBox = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 186, 96, COLORS.ink, 0.92).setStrokeStyle(2, COLORS.magenta).setScrollFactor(0).setDepth(60).setVisible(false);
    this.overlayTitle = this.add
      .text(GAME_WIDTH / 2, 58, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#fff05a",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(61)
      .setVisible(false);

    this.overlayBody = this.add
      .text(GAME_WIDTH / 2, 100, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#f3f5ff",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(61)
      .setVisible(false);
  }

  update(_time, delta) {
    if (!this.inputManager) {
      return;
    }

    const controls = this.inputManager.getState();
    if (controls.pause && !this.pauseLatch) {
      this.pauseLatch = true;
      if (this.state === "playing") {
        this.pauseGame();
      } else if (this.state === "paused") {
        this.resumeGame();
      }
    } else if (!controls.pause) {
      this.pauseLatch = false;
    }

    if (this.state === "paused") {
      return;
    }

    if (this.state === "victory" || this.state === "gameover") {
      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.enter)) {
        if (this.state === "victory") {
          this.scene.restart({
            level: this.level + 1,
            score: this.score,
            challengeSeed: this.challengeSeed,
            ghostData: this.ghostData,
          });
        } else {
          this.scene.start("menu");
        }
      }

      if (Phaser.Input.Keyboard.JustDown(this.actionKeys.esc)) {
        this.scene.start("menu");
      }
      return;
    }

    const step = delta / 16.666;
    const elapsed = this.time.now - this.startTime;
    this.latestControls = controls;

    this.updateShip(controls, step, elapsed);
    this.updateCarriedObject(step);
    this.updateEnemies(step, elapsed);
    this.updatePowerUps(elapsed);
    this.updateGhost(elapsed);
    this.checkPickups();
    this.checkShipCollisions();
    this.updateHud(elapsed);

    this.recorder.record(elapsed, {
      x: this.ship.x,
      y: this.ship.y,
      rotation: this.shipSprite.rotation,
    });
  }

  updateShip(controls, step, elapsed) {
    const turboBoost = elapsed < this.effects.turboUntil ? 1.35 : 1;
    const beamRange = elapsed < this.effects.beamUntil ? 84 : 56;
    const invulnerable = elapsed < this.effects.invulnerableUntil;
    const shieldActive = controls.shield && this.ship.shield > 0;

    this.shieldRing.setPosition(this.ship.x, this.ship.y);
    this.shieldRing.setVisible(shieldActive || invulnerable);
    this.shieldRing.setFillStyle(invulnerable ? COLORS.yellow : COLORS.cyan, invulnerable ? 0.28 : 0.22);

    if (controls.left) {
      this.shipSprite.angle -= 4.4 * step;
    }
    if (controls.right) {
      this.shipSprite.angle += 4.4 * step;
    }

    if (shieldActive) {
      this.ship.shield = Math.max(0, this.ship.shield - 0.4 * step);
    } else if (this.ship.landedPad && this.ship.landedPad.kind === "fuelDepot") {
      this.ship.shield = Math.min(100, this.ship.shield + 0.2 * step);
    }

    if (controls.thrust && this.ship.fuel > 0) {
      if (this.ship.landedPad) {
        this.ship.landedPad = null;
        this.takeoffGraceUntil = elapsed + 260;
        this.ship.y -= 2;
        this.ship.vy = Math.min(this.ship.vy, -1.2);
      }

      const angle = this.shipSprite.rotation - Math.PI / 2;
      const force = 0.08 * turboBoost;
      this.ship.vx += Math.cos(angle) * force * step;
      this.ship.vy += Math.sin(angle) * force * step;
      this.ship.fuel = Math.max(0, this.ship.fuel - this.worldData.fuelDrain * 0.18 * step);

      if (elapsed - this.lastThrustTone > 120) {
        this.game.globals.audio.playSfx("thrust");
        this.lastThrustTone = elapsed;
      }
    }

    if (!this.ship.landedPad) {
      this.ship.vy += this.worldData.gravity * step;
      this.ship.vx *= 0.996;
      this.ship.vy *= 0.998;
      this.ship.x = clamp(this.ship.x + this.ship.vx * step, 14, this.worldData.width - 14);
      this.ship.y = clamp(this.ship.y + this.ship.vy * step, 12, GAME_HEIGHT - 8);
    } else {
      this.ship.vx *= 0.75;
      this.ship.vy = 0;
      this.ship.x = Phaser.Math.Linear(this.ship.x, this.ship.landedPad.x, 0.25);
      this.ship.y = Phaser.Math.Linear(this.ship.y, this.ship.landedPad.y - 10, 0.3);
      if (this.ship.landedPad.kind === "fuelDepot") {
        this.ship.fuel = Math.min(100, this.ship.fuel + 0.35 * step);
      }
      if (this.progress.stage === "launch" && this.ship.landedPad.kind === "assembly" && controls.thrust) {
        this.beginLaunch();
      }
    }

    this.shipSprite.setPosition(this.ship.x, this.ship.y);
    this.handleTractorBeam(controls.beam, beamRange);
  }

  handleTractorBeam(isPressed, beamRange) {
    this.beamGraphics.clear();
    if (!isPressed) {
      if (this.ship.carried) {
        this.releaseCarriedObject();
      }
      return;
    }

    if (!this.ship.carried) {
      const pool = this.progress.stage === "assemble" ? this.parts.filter((part) => !part.placed) : this.fuelPods.filter((pod) => !pod.delivered);
      const candidate = pool
        .map((item) => ({ item, dist: Phaser.Math.Distance.Between(this.ship.x, this.ship.y, item.x, item.y) }))
        .filter((entry) => entry.dist < beamRange)
        .sort((left, right) => left.dist - right.dist)[0];

      if (candidate) {
        this.ship.carried = candidate.item;
        this.statusMessage = candidate.item.kind === "part" ? `TRACTOR ${candidate.item.label} TO ROCKET` : "RETURN FUEL TO ROCKET";
        this.game.globals.audio.playSfx("beam");
      }
    }

    if (this.ship.carried) {
      const anchorAngle = this.shipSprite.rotation + Math.PI / 2;
      const targetX = this.ship.x + Math.cos(anchorAngle) * 12;
      const targetY = this.ship.y + Math.sin(anchorAngle) * 14;
      this.ship.carried.x = Phaser.Math.Linear(this.ship.carried.x, targetX, 0.24);
      this.ship.carried.y = Phaser.Math.Linear(this.ship.carried.y, targetY, 0.24);
      this.ship.carried.sprite.setPosition(this.ship.carried.x, this.ship.carried.y);
      this.ship.carried.marker?.setPosition(
        this.ship.carried.x,
        this.ship.carried.y - (this.ship.carried.kind === "fuel" ? 12 : 14),
      );

      this.beamGraphics.lineStyle(1, COLORS.cyan, 0.95);
      this.beamGraphics.beginPath();
      this.beamGraphics.moveTo(this.ship.x, this.ship.y + 6);
      this.beamGraphics.lineTo(this.ship.carried.x, this.ship.carried.y);
      this.beamGraphics.strokePath();

      if (this.tryDockCarriedObject()) {
        this.beamGraphics.clear();
      }
    }
  }

  tryDockCarriedObject() {
    const item = this.ship.carried;
    if (!item) {
      return false;
    }

    if (item.kind === "part") {
      const slot = this.rocketSlots.find((entry) => entry.key === item.key);
      const slotPosition = { x: this.assemblySite.x + slot.x, y: this.assemblySite.y + slot.y };
      if (distance(item, slotPosition) < 18 * this.worldData.rocketScale) {
        this.completePartPlacement(item, slot, slotPosition);
        return true;
      }
      return false;
    }

    if (item.kind === "fuel") {
      const rocketDistance = Phaser.Math.Distance.Between(item.x, item.y, this.assemblySite.x, this.assemblySite.y - 16);
      if (rocketDistance < 30 * this.worldData.rocketScale && this.progress.stage === "fuel") {
        this.completeFuelDelivery(item);
        return true;
      }
    }

    return false;
  }

  completePartPlacement(item, slot, slotPosition) {
    item.placed = true;
    item.x = slotPosition.x;
    item.y = slotPosition.y;
    item.sprite.setPosition(item.x, item.y).setDepth(16);
    item.marker?.setVisible(false);
    slot.filled = true;
    slot.sprite.setTint(COLORS.green);
    this.ship.carried = null;
    this.progress.partsPlaced += 1;
    this.score += item.score;
    this.statusMessage = `PLACED ${item.label}`;
    this.game.globals.audio.playSfx("place");

    if (this.progress.partsPlaced === PART_TYPES.length) {
      this.progress.stage = "fuel";
      this.fuelPods.forEach((pod) => {
        pod.sprite.setVisible(true);
        pod.marker.setVisible(true);
      });
      this.statusMessage = "ROCKET BUILT - GATHER FUEL PODS";
    }
  }

  completeFuelDelivery(item) {
    item.delivered = true;
    item.sprite.setVisible(false);
    item.marker.setVisible(false);
    this.progress.fuelDelivered += 1;
    this.score += 350;
    this.statusMessage = `FUEL POD ${this.progress.fuelDelivered}/${this.progress.requiredFuel}`;
    this.game.globals.audio.playSfx("collect");

    if (this.progress.fuelDelivered >= this.progress.requiredFuel) {
      this.progress.stage = "launch";
      this.statusMessage = "LAND ON ROCKET PAD AND LAUNCH";
    }
    this.ship.carried = null;
  }

  releaseCarriedObject() {
    const item = this.ship.carried;
    if (!item) {
      return;
    }

    if (item.kind === "part") {
      const slot = this.rocketSlots.find((entry) => entry.key === item.key);
      const slotPosition = { x: this.assemblySite.x + slot.x, y: this.assemblySite.y + slot.y };
      if (distance(item, slotPosition) < 18 * this.worldData.rocketScale) {
        this.completePartPlacement(item, slot, slotPosition);
        return;
      }

      item.x += Phaser.Math.Between(-8, 8);
      item.y = this.worldData.placeOnGround(item.x);
      item.sprite.setPosition(item.x, item.y);
      this.tweens.add({
        targets: item.sprite,
        y: item.y - 6,
        duration: 90,
        yoyo: true,
        ease: "Quad.Out",
      });
      this.statusMessage = "MISPLACED - TRY AGAIN";
    }

    if (item.kind === "fuel") {
      const rocketDistance = Phaser.Math.Distance.Between(item.x, item.y, this.assemblySite.x, this.assemblySite.y - 16);
      if (rocketDistance < 30 * this.worldData.rocketScale && this.progress.stage === "fuel") {
        this.completeFuelDelivery(item);
      } else {
        item.x += Phaser.Math.Between(-8, 8);
        item.y = this.worldData.placeOnGround(item.x, 10);
        item.sprite.setPosition(item.x, item.y);
        this.tweens.add({
          targets: item.sprite,
          y: item.y - 6,
          duration: 90,
          yoyo: true,
          ease: "Quad.Out",
        });
        this.statusMessage = "FUEL MISSED THE TANK";
      }
    }

    this.ship.carried = null;
  }

  updateCarriedObject(step) {
    [...this.parts, ...this.fuelPods].forEach((item) => {
      if (this.ship.carried === item || item.placed || item.delivered) {
        if (item.placed || item.delivered) {
          item.marker?.setVisible(false);
        }
        return;
      }

      const targetY = this.worldData.placeOnGround(item.x, item.kind === "fuel" ? 10 : 8);
      item.y = Phaser.Math.Linear(item.y, targetY, 0.18 * step);
      item.sprite.setPosition(item.x, item.y);
      item.marker?.setPosition(item.x, item.y - (item.kind === "fuel" ? 12 : 14));
    });
  }

  updateEnemies(step, elapsed) {
    this.enemies.forEach((enemy, index) => {
      if (!enemy.alive) {
        return;
      }

      enemy.phase += 0.02 * step;
      if (enemy.key === "doomPoster") {
        enemy.x = enemy.originX + Math.sin(enemy.phase) * 38;
        enemy.y = enemy.originY + Math.cos(enemy.phase * 1.2) * 12;
      } else if (enemy.key === "regDrone") {
        enemy.x += enemy.dir * 0.42 * step;
        if (Math.abs(enemy.x - enemy.originX) > 44) {
          enemy.dir *= -1;
        }
        enemy.y = enemy.originY + Math.sin(enemy.phase * 2) * 4;
      } else if (enemy.key === "socialBot") {
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.ship.x, this.ship.y);
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.ship.x, this.ship.y);
        const speed = dist < 120 ? 0.22 : 0.08;
        enemy.x += Math.cos(angle) * speed * step * 10;
        enemy.y += Math.sin(angle) * speed * step * 10;
      } else if (enemy.key === "alienLawyer") {
        enemy.x += Math.sign(this.ship.x - enemy.x) * 0.28 * step * 6;
        enemy.y = enemy.originY + Math.sin(enemy.phase * 1.7) * 10;
      } else {
        enemy.x += enemy.dir * 0.18 * step * 10;
        if (Math.abs(enemy.x - enemy.originX) > 32) {
          enemy.dir *= -1;
        }
        enemy.y = this.worldData.placeOnGround(enemy.x, 12) - Math.abs(Math.sin(enemy.phase * 2.4) * 10);
      }

      enemy.x = clamp(enemy.x, 24, this.worldData.width - 24);
      enemy.sprite.setPosition(enemy.x, enemy.y);
      enemy.sprite.setTint(elapsed % 400 < 200 ? enemy.color : COLORS.white);
      enemy.sprite.rotation = Math.sin(enemy.phase + index) * 0.08;

      if (Phaser.Math.Distance.Between(enemy.x, enemy.y, this.ship.x, this.ship.y) < 14) {
        if (elapsed < 3500) {
          return;
        }
        if (elapsed < this.effects.invulnerableUntil || (this.inputManager.getState().shield && this.ship.shield > 0)) {
          enemy.alive = false;
          enemy.sprite.setVisible(false);
          this.score += enemy.score;
          this.statusMessage = `DESTROYED ${enemy.label}`;
          this.game.globals.audio.playSfx("explosion");
        } else if (this.ship.shield > 20) {
          this.ship.shield = Math.max(0, this.ship.shield - 20);
          this.ship.vy = Math.min(this.ship.vy, -0.8);
          this.effects.invulnerableUntil = Math.max(this.effects.invulnerableUntil, elapsed + 1500);
          enemy.alive = false;
          enemy.sprite.setVisible(false);
          this.statusMessage = "SHIELD ABSORBED IMPACT";
          this.game.globals.audio.playSfx("explosion");
        } else {
          this.handleCrash("HIT BY ENEMY");
        }
      }
    });
  }

  updatePowerUps(elapsed) {
    this.powerUps.forEach((power) => {
      if (power.collected) {
        return;
      }

      power.sprite.rotation += 0.03;
      if (Phaser.Math.Distance.Between(power.x, power.y, this.ship.x, this.ship.y) < 14) {
        power.collected = true;
        power.sprite.setVisible(false);
        if (power.key === "fuel") {
          this.ship.fuel = Math.min(100, this.ship.fuel + 28);
        } else if (power.key === "shield") {
          this.ship.shield = Math.min(100, this.ship.shield + 35);
        } else if (power.key === "turbo") {
          this.effects.turboUntil = elapsed + 8000;
        } else if (power.key === "beam") {
          this.effects.beamUntil = elapsed + 10000;
        } else if (power.key === "invulnerability") {
          this.effects.invulnerableUntil = elapsed + 7000;
        }
        this.score += 200;
        this.statusMessage = power.label;
        this.effectText.setText(power.label);
        this.time.delayedCall(900, () => this.effectText.setText(""));
        this.game.globals.audio.playSfx("power");
      }
    });
  }

  updateGhost(elapsed) {
    if (!this.ghostSprite || !this.ghostPlayback) {
      return;
    }

    const sample = this.ghostPlayback.sample(elapsed);
    if (!sample) {
      this.ghostSprite.setVisible(false);
      return;
    }

    this.ghostSprite.setVisible(true);
    this.ghostSprite.setPosition(sample.x, sample.y);
    this.ghostSprite.setRotation(sample.rotation);
  }

  checkPickups() {
    this.easterEggs.forEach((egg) => {
      if (egg.found) {
        return;
      }

      if (Phaser.Math.Distance.Between(egg.x, egg.y, this.ship.x, this.ship.y) < 14) {
        egg.found = true;
        egg.sprite.setTint(COLORS.yellow);
        this.score += 150;
        this.statusMessage = `FOUND ${egg.label.toUpperCase()}`;
        this.game.globals.audio.playSfx("collect");
      }
    });
  }

  checkShipCollisions() {
    const collision = this.worldData.getCollisionInfo(this.ship.x, this.ship.y, 7);
    const elapsed = this.time.now - this.startTime;

    if (this.ship.landedPad && !this.latestControls?.thrust) {
      this.ship.y = (collision.groundY || this.ship.landedPad.y) - 10;
      this.shipSprite.setPosition(this.ship.x, this.ship.y);
      return;
    }

    if (collision.hitCeiling) {
      this.handleCrash("CAVE CEILING");
      return;
    }

    if (elapsed < this.takeoffGraceUntil && this.ship.vy <= 0) {
      return;
    }

    if (!collision.hitGround) {
      return;
    }

    const safeSpeed = Math.hypot(this.ship.vx, this.ship.vy) < 1.45;
    const safeAngle = Math.abs(wrapAngleDegrees(this.shipSprite.angle)) < 14;
    const impactSpeed = Math.hypot(this.ship.vx, this.ship.vy);

    if (collision.pad && safeSpeed && safeAngle) {
      this.landOnPad(collision.pad, collision.groundY || collision.floorY);
      return;
    }

    if (collision.insideCave && safeSpeed && Math.abs(this.ship.vy) < 1.2) {
      this.landOnGround(collision.floorY);
      return;
    }

    if (this.inputManager.getState().shield && this.ship.shield > 0) {
      this.ship.vy = -Math.abs(this.ship.vy) * 0.5;
      this.ship.vx *= 0.7;
      this.ship.shield = Math.max(0, this.ship.shield - 18);
      this.ship.y -= 6;
      this.shipSprite.setPosition(this.ship.x, this.ship.y);
      this.statusMessage = "SHIELD SAVED YOU";
      return;
    }

    if (this.ship.shield > 12 && impactSpeed < 2.25) {
      this.ship.shield = Math.max(0, this.ship.shield - 12);
      this.ship.vy = -0.9;
      this.ship.vx *= 0.85;
      this.ship.y -= 4;
      this.shipSprite.setPosition(this.ship.x, this.ship.y);
      this.statusMessage = "ROUGH IMPACT SOFTENED";
      return;
    }

    this.handleCrash(collision.pad ? "ROUGH LANDING" : "CRASH");
  }

  landOnPad(pad, groundY) {
    if (this.ship.landedPad === pad) {
      return;
    }

    this.ship.landedPad = pad;
    this.ship.vx = 0;
    this.ship.vy = 0;
    this.shipSprite.angle = 0;
    this.ship.y = groundY - 10;
    this.shipSprite.setPosition(this.ship.x, this.ship.y);
    this.statusMessage = pad.kind === "fuelDepot" ? "FUEL DEPOT ACTIVE" : "PAD LANDED";
    if (pad.kind === "assembly" && this.ship.carried) {
      this.tryDockCarriedObject();
    }
    this.game.globals.audio.playSfx("land");
  }

  landOnGround(groundY) {
    this.ship.vx *= 0.8;
    this.ship.vy = 0;
    this.ship.y = groundY - 10;
    this.shipSprite.setPosition(this.ship.x, this.ship.y);
    this.statusMessage = "CAVE FLOOR SCRAPE";
  }

  handleCrash(message) {
    if (this.state !== "playing") {
      return;
    }

    this.ship.lives -= 1;
    this.ship.vx = 0;
    this.ship.vy = 0;
    this.ship.shield = Math.max(0, this.ship.shield - 10);
    this.statusMessage = message;
    this.game.globals.audio.playSfx("explosion");

    if (this.ship.lives <= 0) {
      this.finishRun("gameover");
      return;
    }

    this.ship.x = this.worldData.assemblyPad.x;
    this.ship.y = this.worldData.assemblyPad.y - 24;
    this.shipSprite.setPosition(this.ship.x, this.ship.y);
    this.shipSprite.angle = 0;
    this.ship.landedPad = this.worldData.assemblyPad;
    this.effects.invulnerableUntil = Math.max(this.effects.invulnerableUntil, this.time.now - this.startTime + 3000);
    if (this.ship.carried) {
      this.releaseCarriedObject();
    }
  }

  beginLaunch() {
    const elapsed = this.time.now - this.startTime;
    const efficiencyBonus = Math.round(this.ship.fuel * 12 + this.ship.shield * 5);
    const speedBonus = Math.max(250, 6000 - Math.round(elapsed / 3));
    this.score += efficiencyBonus + speedBonus;
    this.game.globals.audio.playSfx("launch");
    this.finishRun("victory");
  }

  finishRun(result) {
    if (this.finalizedRun) {
      return;
    }

    this.finalizedRun = true;
    this.state = result;
    const elapsed = this.time.now - this.startTime;
    const entry = {
      name: this.settings.pilotName,
      score: this.score,
      timeMs: elapsed,
      level: this.level,
      date: new Date().toISOString(),
    };
    saveScore(entry);

    const stats = loadStats();
    stats.bestScore = Math.max(stats.bestScore || 0, this.score);
    let savedGhost = false;
    if (result === "victory" && (!stats.fastestLaunchMs || elapsed < stats.fastestLaunchMs)) {
      stats.fastestLaunchMs = elapsed;
      saveGhost(this.recorder.export(this.challengeSeed, this.score, elapsed));
      savedGhost = true;
    }
    saveStats(stats);

    this.overlayBox.setVisible(true);
    this.overlayTitle.setVisible(true);
    this.overlayBody.setVisible(true);

    if (result === "victory") {
      this.game.globals.audio.stopSong();
      this.game.globals.audio.playSong("victory");
      this.overlayTitle.setText("MARS BOUND");
      this.overlayBody.setText(
        [
          `SCORE ${this.score}`,
          `TIME ${(elapsed / 1000).toFixed(1)}s`,
          `WORLD ${this.level} CLEARED`,
          savedGhost ? "NEW GHOST RECORDED" : "GHOST READY",
          "",
          "ENTER NEXT WORLD",
          "ESC MENU",
        ].join("\n"),
      );
    } else {
      this.game.globals.audio.stopSong();
      this.game.globals.audio.playSong("gameOver");
      this.overlayTitle.setText("GAME OVER");
      this.overlayBody.setText(
        [
          `SCORE ${this.score}`,
          `PARTS ${this.progress.partsPlaced}/5`,
          `FUEL ${this.progress.fuelDelivered}/${this.progress.requiredFuel}`,
          "",
          "ENTER MENU",
          "ESC MENU",
        ].join("\n"),
      );
    }
  }

  pauseGame() {
    if (this.state !== "playing") {
      return;
    }

    this.state = "paused";
    this.overlayBox.setVisible(true);
    this.overlayTitle.setVisible(true).setText("PAUSED");
    this.overlayBody.setVisible(true).setText("ESC TO RESUME");
  }

  resumeGame() {
    this.state = "playing";
    this.overlayBox.setVisible(false);
    this.overlayTitle.setVisible(false);
    this.overlayBody.setVisible(false);
  }

  updateHud(elapsed) {
    const fuelLeft = formatMeter(this.ship.fuel);
    const shieldLeft = formatMeter(this.ship.shield);
    const levelText = `WORLD ${this.level}`;
    this.hudText.setText([
      `FUEL ${fuelLeft}`,
      `SHLD ${shieldLeft}`,
      `LIVES ${this.ship.lives}`,
    ]);

    this.hudRight.setText([
      `${levelText}`,
      `SCORE ${this.score}`,
      `TIME ${(elapsed / 1000).toFixed(1)}s`,
    ]);

    let objective = this.statusMessage;
    if (this.progress.stage === "assemble") {
      objective = `${this.statusMessage} ${this.progress.partsPlaced}/5`;
    } else if (this.progress.stage === "fuel") {
      objective = `${this.statusMessage} ${this.progress.fuelDelivered}/${this.progress.requiredFuel}`;
    } else if (this.progress.stage === "launch") {
      objective = "ROCKET READY - THRUST TO LAUNCH";
    }

    this.messageText.setText(objective);
  }

  shutdown() {
    this.inputManager?.destroy();
  }
}
