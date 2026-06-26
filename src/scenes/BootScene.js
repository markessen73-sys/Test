import Phaser from "phaser";
import { createTextures } from "../game/textures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    const base = import.meta.env.BASE_URL || "/";
    this.load.image("vegas-caesars", `${base}vegas/caesars.jpg`);
    this.load.image("vegas-mandalay", `${base}vegas/mandalay.jpg`);
    this.load.image("vegas-montecarlo", `${base}vegas/montecarlo.jpg`);
  }

  create() {
    createTextures(this);
    this.scene.start("title");
  }
}
