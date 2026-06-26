import Phaser from "phaser";
import { createTextures } from "../game/textures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.image("vegas-caesars", "/vegas/caesars.jpg");
    this.load.image("vegas-mandalay", "/vegas/mandalay.jpg");
    this.load.image("vegas-montecarlo", "/vegas/montecarlo.jpg");
  }

  create() {
    createTextures(this);
    this.scene.start("title");
  }
}
