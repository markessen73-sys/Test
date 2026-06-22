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
  create(scene, "ship", 16, 12, (g) => {
    pixel(g, COLORS.magenta, 1, 4, 10, 4);
    pixel(g, COLORS.white, 3, 2, 6, 2);
    pixel(g, COLORS.cyan, 10, 3, 5, 6);
    pixel(g, COLORS.yellow, 5, 0, 3, 2);
    pixel(g, COLORS.blue, 2, 8, 7, 2);
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

  create(scene, "door", 16, 32, (g) => {
    pixel(g, COLORS.yellow, 0, 0, 16, 32);
    pixel(g, COLORS.orange, 2, 2, 12, 28);
    pixel(g, COLORS.black, 5, 14, 2, 2);
  });

  create(scene, "teleporter", 16, 16, (g) => {
    pixel(g, COLORS.cyan, 0, 0, 16, 16);
    pixel(g, COLORS.blue, 2, 2, 12, 12);
    pixel(g, COLORS.white, 4, 4, 8, 8);
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
}
