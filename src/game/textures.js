import { COLORS } from "./constants";

function pixel(graphics, color, x, y, w, h = w) {
  graphics.fillStyle(color, 1);
  graphics.fillRect(x, y, w, h);
}

function create(scene, key, width, height, draw) {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.make.graphics({ add: false });
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

export function createTextures(scene) {
  create(scene, "ship-right", 16, 12, (g) => {
    pixel(g, COLORS.gray, 2, 7, 8, 3);
    pixel(g, COLORS.white, 4, 5, 7, 2);
    pixel(g, COLORS.gray, 6, 3, 7, 2);
    pixel(g, COLORS.gray, 10, 1, 4, 2);
    pixel(g, COLORS.cyan, 8, 4, 4, 1);
    pixel(g, COLORS.red, 2, 9, 1, 2);
    pixel(g, COLORS.red, 4, 9, 1, 2);
    pixel(g, COLORS.yellow, 12, 9, 2, 1);
    pixel(g, COLORS.yellow, 13, 6, 2, 1);
  });

  create(scene, "ship-left", 16, 12, (g) => {
    pixel(g, COLORS.gray, 6, 7, 8, 3);
    pixel(g, COLORS.white, 5, 5, 7, 2);
    pixel(g, COLORS.gray, 3, 3, 7, 2);
    pixel(g, COLORS.gray, 2, 1, 4, 2);
    pixel(g, COLORS.cyan, 4, 4, 4, 1);
    pixel(g, COLORS.red, 13, 9, 1, 2);
    pixel(g, COLORS.red, 11, 9, 1, 2);
    pixel(g, COLORS.yellow, 2, 9, 2, 1);
    pixel(g, COLORS.yellow, 1, 6, 2, 1);
  });

  create(scene, "ship-up", 12, 16, (g) => {
    pixel(g, COLORS.gray, 3, 4, 6, 10);
    pixel(g, COLORS.white, 2, 6, 8, 8);
    pixel(g, COLORS.gray, 4, 1, 4, 5);
    pixel(g, COLORS.cyan, 4, 3, 4, 2);
    pixel(g, COLORS.yellow, 4, 1, 1, 2);
    pixel(g, COLORS.yellow, 7, 1, 1, 2);
    pixel(g, COLORS.red, 4, 13, 2, 2);
    pixel(g, COLORS.red, 6, 13, 2, 2);
  });

  create(scene, "ship-down", 12, 16, (g) => {
    pixel(g, COLORS.gray, 3, 2, 6, 10);
    pixel(g, COLORS.white, 2, 2, 8, 8);
    pixel(g, COLORS.gray, 4, 10, 4, 5);
    pixel(g, COLORS.cyan, 4, 10, 4, 2);
    pixel(g, COLORS.yellow, 4, 13, 1, 2);
    pixel(g, COLORS.yellow, 7, 13, 1, 2);
    pixel(g, COLORS.red, 4, 1, 2, 2);
    pixel(g, COLORS.red, 6, 1, 2, 2);
  });

  create(scene, "drone", 12, 12, (g) => {
    pixel(g, COLORS.yellow, 2, 4, 8, 4);
    pixel(g, COLORS.red, 0, 5, 12, 2);
    pixel(g, COLORS.black, 3, 5, 2, 2);
    pixel(g, COLORS.black, 7, 5, 2, 2);
  });

  create(scene, "orb", 10, 10, (g) => {
    pixel(g, COLORS.orange, 2, 1, 6, 8);
    pixel(g, COLORS.yellow, 3, 2, 4, 6);
  });

  create(scene, "spark", 8, 16, (g) => {
    pixel(g, COLORS.yellow, 2, 0, 4, 16);
    pixel(g, COLORS.white, 3, 2, 2, 12);
  });

  create(scene, "fireball", 8, 8, (g) => {
    pixel(g, COLORS.red, 1, 1, 6, 6);
    pixel(g, COLORS.orange, 2, 2, 4, 4);
  });

  create(scene, "tunnel-exit", 24, 32, (g) => {
    pixel(g, COLORS.black, 0, 0, 24, 32);
    pixel(g, COLORS.gray, 2, 0, 20, 32);
    pixel(g, COLORS.black, 4, 3, 16, 26);
    pixel(g, COLORS.navy, 6, 6, 12, 20);
    pixel(g, COLORS.black, 8, 9, 8, 14);
    pixel(g, COLORS.orange, 2, 2, 20, 2);
    pixel(g, COLORS.yellow, 2, 4, 2, 24);
    pixel(g, COLORS.yellow, 20, 4, 2, 24);
    pixel(g, COLORS.white, 10, 12, 4, 8);
  });

  create(scene, "tunnel-warp", 20, 20, (g) => {
    pixel(g, COLORS.black, 0, 0, 20, 20);
    pixel(g, COLORS.cyan, 1, 1, 18, 18);
    pixel(g, COLORS.black, 3, 3, 14, 14);
    pixel(g, COLORS.blue, 5, 5, 10, 10);
    pixel(g, COLORS.white, 7, 7, 6, 6);
    pixel(g, COLORS.cyan, 8, 8, 4, 4);
  });

  create(scene, "relic", 12, 12, (g) => {
    pixel(g, COLORS.yellow, 2, 0, 8, 12);
    pixel(g, COLORS.white, 4, 2, 4, 8);
    pixel(g, COLORS.orange, 1, 10, 10, 2);
  });

  create(scene, "star", 8, 8, (g) => {
    pixel(g, COLORS.yellow, 1, 1, 6, 6);
    pixel(g, COLORS.orange, 2, 2, 4, 4);
    pixel(g, COLORS.white, 3, 3, 2, 2);
  });

  create(scene, "turret", 16, 16, (g) => {
    pixel(g, COLORS.red, 2, 4, 12, 8);
    pixel(g, COLORS.orange, 5, 1, 8, 4);
    pixel(g, COLORS.black, 10, 5, 4, 2);
  });

  create(scene, "tunnel-core", 20, 20, (g) => {
    pixel(g, COLORS.black, 0, 0, 20, 20);
    pixel(g, COLORS.orange, 1, 1, 18, 18);
    pixel(g, COLORS.black, 3, 3, 14, 14);
    pixel(g, COLORS.red, 5, 5, 10, 10);
    pixel(g, COLORS.yellow, 8, 8, 4, 4);
  });
}
