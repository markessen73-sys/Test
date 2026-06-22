import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH, HUD_HEIGHT, PLAYFIELD_Y, SCREEN_SEQUENCE, TILE_SIZE } from "../game/constants";
import { getNextLoop, getScreen } from "../game/levels";
import { InputManager } from "../game/input";
import { loadHiScore, saveHiScore } from "../game/storage";

function overlaps(a, b) {
  return (
    a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
  );
}

function makeRect(x, y, width, height) {
  return { x, y, width, height };
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
  }

  init(data) {
    this.score = data.score ?? 0;
    this.lives = data.lives ?? 4;
    this.cycle = data.cycle ?? 1;
    this.hiScore = Math.max(data.hiScore ?? 0, loadHiScore());
    this.screenKey = data.screenKey || SCREEN_SEQUENCE[0];
    this.pendingStart = data.start || null;
  }

  create() {
    this.inputManager = new InputManager(this);
    this.pauseLatch = false;
    this.state = "playing";
    this.loopStats = getNextLoop(this.cycle);

    this.bgLayer = this.add.graphics();
    this.wallLayer = this.add.graphics();
    this.patternLayer = this.add.graphics();

    this.player = this.add.image(32, PLAYFIELD_Y + 132, "ship").setOrigin(0.5);
    this.playerDepth = 5;
    this.player.setDepth(this.playerDepth);
    this.playerHitbox = { width: 12, height: 10 };
    this.playerInvulnerableUntil = 0;

    this.hudBar = this.add.rectangle(GAME_WIDTH / 2, HUD_HEIGHT / 2, GAME_WIDTH, HUD_HEIGHT, COLORS.purple).setOrigin(0.5);
    this.hudText = this.add.text(8, 6, "", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
    });
    this.hudRight = this.add.text(GAME_WIDTH - 8, 6, "", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffef75",
      align: "right",
    }).setOrigin(1, 0);
    this.messageText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 10, "", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    }).setOrigin(0.5);

    this.overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 220, 90, COLORS.black, 0.9).setStrokeStyle(4, COLORS.cyan).setVisible(false);
    this.overlayTitle = this.add.text(GAME_WIDTH / 2, 72, "", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#6cf0ff",
    }).setOrigin(0.5).setVisible(false);
    this.overlayBody = this.add.text(GAME_WIDTH / 2, 114, "", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#ffffff",
      align: "center",
    }).setOrigin(0.5).setVisible(false);

    this.spawnLayer = [];
    this.hazardSprites = [];
    this.projectiles = [];
    this.pickupSprites = [];
    this.levelTimer = 0;
    this.flashTimer = 0;

    this.game.globals.audio.playTheme("game");
    this.loadScreen(this.screenKey, this.pendingStart);
  }

  clearScreenObjects() {
    [...this.spawnLayer, ...this.hazardSprites.map((hazard) => hazard.sprite), ...this.projectiles.map((proj) => proj.sprite), ...this.pickupSprites.map((pickup) => pickup.sprite)].forEach((sprite) => sprite?.destroy());
    this.spawnLayer = [];
    this.hazardSprites = [];
    this.projectiles = [];
    this.pickupSprites = [];
  }

  loadScreen(key, startOverride = null) {
    this.clearScreenObjects();
    this.currentScreen = getScreen(key);
    this.screenKey = key;
    this.levelTimer = 0;
    this.loopStats = getNextLoop(this.cycle);

    this.drawScreen();

    if (this.currentScreen.exit) {
      const exit = this.add.image(this.currentScreen.exit.x + 8, this.currentScreen.exit.y + 16, "door").setDepth(3);
      this.spawnLayer.push(exit);
    }

    if (this.currentScreen.teleporter) {
      const teleporter = this.add.image(this.currentScreen.teleporter.x + 8, this.currentScreen.teleporter.y + 8, "teleporter").setDepth(3);
      this.spawnLayer.push(teleporter);
    }

    if (this.currentScreen.relic) {
      const relic = this.add.image(this.currentScreen.relic.x + 6, this.currentScreen.relic.y + 6, "relic").setDepth(3);
      this.spawnLayer.push(relic);
      this.relicSprite = relic;
    } else {
      this.relicSprite = null;
    }

    this.pickupSprites = this.currentScreen.pickups.map((pickup) => ({
      ...pickup,
      collected: false,
      rect: makeRect(pickup.x - 4, pickup.y - 4, 8, 8),
      sprite: this.add.image(pickup.x, pickup.y, "star").setDepth(3),
    }));

    this.hazardSprites = this.currentScreen.hazards.map((hazard, index) => {
      const spriteKey = hazard.type === "turret" ? "turret" : hazard.type === "spark" ? "spark" : hazard.type === "orbit" ? "orb" : "drone";
      const sprite = this.add.image(hazard.x, hazard.y, spriteKey).setDepth(4);
      return {
        ...hazard,
        id: index,
        baseX: hazard.x,
        baseY: hazard.y,
        sprite,
        nextShotAt: hazard.fireRate || 0,
      };
    });

    const start = startOverride || this.currentScreen.start;
    this.player.setPosition(start.x, start.y);
    this.playerInvulnerableUntil = this.time.now + 700;
    this.messageText.setText(this.currentScreen.name);
  }

  drawScreen() {
    const { bg, wall, accent } = this.currentScreen.palette;
    this.cameras.main.setBackgroundColor(bg);
    this.bgLayer.clear();
    this.wallLayer.clear();
    this.patternLayer.clear();

    this.bgLayer.fillStyle(bg, 1);
    this.bgLayer.fillRect(0, PLAYFIELD_Y, GAME_WIDTH, GAME_HEIGHT - HUD_HEIGHT);

    for (let y = PLAYFIELD_Y; y < GAME_HEIGHT; y += TILE_SIZE) {
      for (let x = 0; x < GAME_WIDTH; x += TILE_SIZE) {
        if (((x + y) / TILE_SIZE) % 2 === 0) {
          this.patternLayer.fillStyle(accent, 0.11);
          this.patternLayer.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    this.currentScreen.solids.forEach((solid) => {
      this.wallLayer.fillStyle(wall, 1);
      this.wallLayer.fillRect(solid.x, solid.y, solid.width, solid.height);
      this.wallLayer.lineStyle(1, accent, 1);
      this.wallLayer.strokeRect(solid.x + 0.5, solid.y + 0.5, solid.width - 1, solid.height - 1);
    });

    if (this.currentScreen.exit) {
      this.addLabel(this.currentScreen.exit.x - 2, this.currentScreen.exit.y - 10, this.currentScreen.doorText || "DOOR");
    }
    if (this.currentScreen.teleporter) {
      this.addLabel(this.currentScreen.teleporter.x - 8, this.currentScreen.teleporter.y - 10, "WARP");
    }
    if (this.currentScreen.relic) {
      this.addLabel(this.currentScreen.relic.x - 12, this.currentScreen.relic.y - 10, "CORE");
    }
  }

  addLabel(x, y, text) {
    const label = this.add.text(x, y, text, {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#ffffff",
    }).setDepth(3);
    this.spawnLayer.push(label);
  }

  getPlayerRect(nextX = this.player.x, nextY = this.player.y) {
    return makeRect(
      nextX - this.playerHitbox.width / 2,
      nextY - this.playerHitbox.height / 2,
      this.playerHitbox.width,
      this.playerHitbox.height,
    );
  }

  collidesWithWall(rect) {
    return this.currentScreen.solids.some((solid) => overlaps(rect, solid));
  }

  movePlayer(axis, amount) {
    const nextX = axis === "x" ? this.player.x + amount : this.player.x;
    const nextY = axis === "y" ? this.player.y + amount : this.player.y;
    const rect = this.getPlayerRect(nextX, nextY);
    if (!this.collidesWithWall(rect)) {
      this.player.setPosition(nextX, nextY);
    }
  }

  update(time, delta) {
    if (this.state === "cleared") {
      return;
    }

    const input = this.inputManager.getPlayState();
    if (input.pause && !this.pauseLatch) {
      this.pauseLatch = true;
      if (this.state === "playing") {
        this.state = "paused";
        this.showOverlay("PAUSED", "PRESS ESC TO RESUME");
      } else if (this.state === "paused") {
        this.state = "playing";
        this.hideOverlay();
      } else {
        this.scene.start("title");
      }
    } else if (!input.pause) {
      this.pauseLatch = false;
    }

    if (this.state !== "playing") {
      return;
    }

    this.levelTimer += delta;
    this.updateHazards(delta, time);

    const distance = this.loopStats.playerSpeed * (delta / 1000);
    if (input.x !== 0) {
      this.movePlayer("x", input.x * distance);
      this.player.setAngle(input.x > 0 ? 0 : 180);
    } else if (input.y !== 0) {
      this.movePlayer("y", input.y * distance);
      this.player.setAngle(input.y > 0 ? 90 : -90);
    }

    this.checkTransitions();
    this.checkPickups();
    this.checkHazardCollisions(time);
    this.updateHud();
    this.player.setVisible(time > this.playerInvulnerableUntil || Math.floor(time / 80) % 2 === 0);
  }

  updateHazards(delta, time) {
    const step = delta / 1000;
    const speedFactor = this.loopStats.hazardSpeedMultiplier;

    this.hazardSprites.forEach((hazard) => {
      if (hazard.type === "patrolH") {
        hazard.sprite.x = hazard.baseX + Math.sin(time * 0.001 * hazard.speed * speedFactor + hazard.phase) * hazard.amplitude;
      } else if (hazard.type === "patrolV") {
        hazard.sprite.y = hazard.baseY + Math.sin(time * 0.001 * hazard.speed * speedFactor + hazard.phase) * hazard.amplitude;
      } else if (hazard.type === "orbit") {
        hazard.sprite.x = hazard.baseX + Math.cos(time * 0.001 * hazard.speed * speedFactor + hazard.phase) * hazard.radius;
        hazard.sprite.y = hazard.baseY + Math.sin(time * 0.001 * hazard.speed * speedFactor + hazard.phase) * hazard.radius;
      } else if (hazard.type === "spark") {
        hazard.sprite.y = hazard.baseY + Math.sin(time * 0.001 * hazard.speed * speedFactor + hazard.phase) * hazard.amplitude;
      } else if (hazard.type === "turret") {
        if (time >= hazard.nextShotAt) {
          hazard.nextShotAt = time + hazard.fireRate / speedFactor;
          this.spawnProjectile(hazard.sprite.x - 12, hazard.sprite.y, -110 * speedFactor);
        }
      }
    });

    this.projectiles.forEach((projectile) => {
      projectile.sprite.x += projectile.vx * step;
    });
    this.projectiles = this.projectiles.filter((projectile) => {
      const active = projectile.sprite.x > -8 && projectile.sprite.x < GAME_WIDTH + 8;
      if (!active) {
        projectile.sprite.destroy();
      }
      return active;
    });
  }

  spawnProjectile(x, y, vx) {
    const sprite = this.add.image(x, y, "fireball").setDepth(4);
    this.projectiles.push({ sprite, vx });
  }

  checkTransitions() {
    const rect = this.getPlayerRect();

    if (this.currentScreen.exit && overlaps(rect, this.currentScreen.exit)) {
      this.score += this.loopStats.screenClearBonus;
      this.game.globals.audio.playSfx("warp");
      this.loadScreen(this.currentScreen.exit.target, this.currentScreen.exit.targetStart);
      return;
    }

    if (this.currentScreen.teleporter && overlaps(rect, this.currentScreen.teleporter)) {
      this.score += this.loopStats.screenClearBonus + 75;
      this.game.globals.audio.playSfx("warp");
      this.loadScreen(this.currentScreen.teleporter.target, this.currentScreen.teleporter.targetStart);
      return;
    }

    if (this.currentScreen.relic && overlaps(rect, this.currentScreen.relic)) {
      this.completeCycle();
    }
  }

  checkPickups() {
    const rect = this.getPlayerRect();
    this.pickupSprites.forEach((pickup) => {
      if (!pickup.collected && overlaps(rect, pickup.rect)) {
        pickup.collected = true;
        pickup.sprite.destroy();
        this.score += 50;
        this.messageText.setText("STAR CACHE +50");
        this.game.globals.audio.playSfx("pickup");
      }
    });
  }

  checkHazardCollisions(time) {
    if (time < this.playerInvulnerableUntil) {
      return;
    }

    const rect = this.getPlayerRect();
    const hitHazard = this.hazardSprites.some((hazard) => overlaps(rect, makeRect(hazard.sprite.x - 6, hazard.sprite.y - 6, 12, 12)));
    const hitProjectile = this.projectiles.some((projectile) => overlaps(rect, makeRect(projectile.sprite.x - 4, projectile.sprite.y - 4, 8, 8)));

    if (hitHazard || hitProjectile) {
      this.killPlayer();
    }
  }

  killPlayer() {
    this.lives -= 1;
    this.game.globals.audio.playSfx("hit");

    if (this.lives <= 0) {
      this.hiScore = Math.max(this.hiScore, this.score);
      saveHiScore(this.hiScore);
      this.state = "gameover";
      this.game.globals.audio.stopTheme();
      this.game.globals.audio.playTheme("lose", false);
      this.showOverlay("GAME OVER", `SCORE ${this.score}\nHI ${this.hiScore}\n\nESC TO TITLE`);
      return;
    }

    this.player.setPosition(this.currentScreen.start.x, this.currentScreen.start.y);
    this.playerInvulnerableUntil = this.time.now + 900;
    this.projectiles.forEach((projectile) => projectile.sprite.destroy());
    this.projectiles = [];
    this.messageText.setText("SHIP LOST - RETRY");
  }

  completeCycle() {
    this.score += this.loopStats.relicBonus;
    this.hiScore = Math.max(this.hiScore, this.score);
    saveHiScore(this.hiScore);
    this.state = "cleared";
    this.game.globals.audio.stopTheme();
    this.game.globals.audio.playTheme("win", false);
    this.showOverlay("VAULT CLEARED", `SCORE ${this.score}\nCYCLE ${this.cycle}\n\nNEXT LOOP READY`);
    this.time.delayedCall(1600, () => {
      this.cycle += 1;
      this.state = "playing";
      this.game.globals.audio.playTheme("game");
      this.hideOverlay();
      this.loadScreen(SCREEN_SEQUENCE[0]);
    });
  }

  showOverlay(title, body) {
    this.overlay.setVisible(true);
    this.overlayTitle.setText(title).setVisible(true);
    this.overlayBody.setText(body).setVisible(true);
  }

  hideOverlay() {
    this.overlay.setVisible(false);
    this.overlayTitle.setVisible(false);
    this.overlayBody.setVisible(false);
  }

  updateHud() {
    this.hudText.setText(`SCORE ${String(this.score).padStart(6, "0")}  LIVES ${this.lives}`);
    this.hudRight.setText(`${this.currentScreen.name}\nHI ${String(this.hiScore).padStart(6, "0")}`);
  }
}
