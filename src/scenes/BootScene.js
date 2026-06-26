import Phaser from "phaser";
import { createTextures } from "../game/textures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    createTextures(this);
    this.scene.start("title");
  }
}
