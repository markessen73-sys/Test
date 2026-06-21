import { COLORS, EASTER_EGGS, ENEMY_TYPES, PART_TYPES, POWER_UP_TYPES } from "./constants";

function pixel(graphics, color, x, y, width, height = width) {
  graphics.fillStyle(color, 1);
  graphics.fillRect(x, y, width, height);
}

function addIfMissing(scene, key, draw, width, height) {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

export function createTextures(scene) {
  addIfMissing(
    scene,
    "ship",
    (graphics) => {
      pixel(graphics, COLORS.yellow, 7, 0, 3, 2);
      pixel(graphics, COLORS.cyan, 6, 2, 4, 3);
      pixel(graphics, COLORS.cyan, 4, 5, 8, 2);
      pixel(graphics, COLORS.white, 1, 7, 11, 3);
      pixel(graphics, COLORS.magenta, 0, 10, 16, 3);
      pixel(graphics, COLORS.blue, 11, 6, 4, 2);
      pixel(graphics, COLORS.yellow, 6, 11, 4, 4);
      pixel(graphics, COLORS.red, 3, 14, 9, 2);
    },
    16,
    16,
  );

  addIfMissing(
    scene,
    "ghostShip",
    (graphics) => {
      pixel(graphics, COLORS.white, 6, 0, 4, 3);
      pixel(graphics, COLORS.white, 4, 3, 8, 2);
      pixel(graphics, COLORS.blue, 2, 5, 12, 3);
      pixel(graphics, COLORS.magenta, 0, 8, 16, 3);
      pixel(graphics, COLORS.cyan, 6, 11, 4, 4);
      pixel(graphics, COLORS.violet, 4, 14, 8, 2);
    },
    16,
    16,
  );

  PART_TYPES.forEach((part, index) => {
    addIfMissing(
      scene,
      `part-${part.key}`,
      (graphics) => {
        pixel(graphics, COLORS.paper, 0, 0, 14, 10);
        pixel(graphics, part.color, 1, 1, 12, 8);
        pixel(graphics, COLORS.paper, 2, 2, 10, 6);
        pixel(graphics, part.color, 3, 3, 8, 4);
        pixel(graphics, COLORS.white, 4 + (index % 3), 4, 3, 2);
      },
      14,
      10,
    );
  });

  ENEMY_TYPES.forEach((enemy, index) => {
    addIfMissing(
      scene,
      `enemy-${enemy.key}`,
      (graphics) => {
        pixel(graphics, enemy.color, 2, 2, 12, 4);
        pixel(graphics, enemy.color, 0, 6, 16, 4);
        pixel(graphics, COLORS.paper, 3, 7, 2, 2);
        pixel(graphics, COLORS.paper, 11, 7, 2, 2);
        pixel(graphics, COLORS.white, 5 + (index % 2), 1, 4, 2);
        pixel(graphics, COLORS.magenta, 6, 10, 4, 3);
      },
      16,
      13,
    );
  });

  POWER_UP_TYPES.forEach((powerUp, index) => {
    addIfMissing(
      scene,
      `power-${powerUp.key}`,
      (graphics) => {
        pixel(graphics, powerUp.color, 5, 0, 6, 3);
        pixel(graphics, powerUp.color, 2, 3, 12, 6);
        pixel(graphics, COLORS.paper, 4, 4, 8, 4);
        pixel(graphics, powerUp.color, 6, 10, 4, 4);
        pixel(graphics, COLORS.white, 6 + (index % 2), 5, 2, 2);
      },
      16,
      14,
    );
  });

  addIfMissing(
    scene,
    "fuelPod",
    (graphics) => {
      pixel(graphics, COLORS.yellow, 2, 2, 8, 10);
      pixel(graphics, COLORS.orange, 3, 3, 6, 8);
      pixel(graphics, COLORS.white, 4, 4, 4, 2);
    },
    12,
    14,
  );

  addIfMissing(
    scene,
    "landingPad",
    (graphics) => {
      pixel(graphics, COLORS.white, 0, 3, 24, 2);
      pixel(graphics, COLORS.cyan, 2, 0, 3, 3);
      pixel(graphics, COLORS.cyan, 19, 0, 3, 3);
    },
    24,
    5,
  );

  addIfMissing(
    scene,
    "fuelDepot",
    (graphics) => {
      pixel(graphics, COLORS.green, 0, 6, 20, 4);
      pixel(graphics, COLORS.white, 3, 0, 4, 6);
      pixel(graphics, COLORS.white, 13, 0, 4, 6);
      pixel(graphics, COLORS.magenta, 7, 2, 6, 4);
    },
    20,
    10,
  );

  addIfMissing(
    scene,
    "rocketSlot",
    (graphics) => {
      pixel(graphics, COLORS.paper, 0, 0, 12, 12);
      pixel(graphics, COLORS.cyan, 0, 0, 12, 1);
      pixel(graphics, COLORS.cyan, 0, 11, 12, 1);
      pixel(graphics, COLORS.cyan, 0, 0, 1, 12);
      pixel(graphics, COLORS.cyan, 11, 0, 1, 12);
    },
    12,
    12,
  );

  EASTER_EGGS.forEach((egg, index) => {
    addIfMissing(
      scene,
      `egg-${index}`,
      (graphics) => {
        pixel(graphics, COLORS.paper, 0, 0, 16, 12);
        pixel(graphics, [COLORS.red, COLORS.orange, COLORS.green, COLORS.cyan, COLORS.magenta][index], 2, 2, 12, 8);
        pixel(graphics, COLORS.white, 5, 4, 6, 4);
      },
      16,
      12,
    );
  });
}
