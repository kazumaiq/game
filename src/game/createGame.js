/**
 * createGame.js — инициализация инстанса игры Phaser.
 */
import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LocationSelectScene from './scenes/LocationSelectScene.js';
import CarWashScene from './scenes/CarWashScene.js';

export function createGame() {
  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 900,
    height: 700,
    backgroundColor: '#1a1a2e',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, MenuScene, LocationSelectScene, CarWashScene],
  };

  return new Phaser.Game(config);
}
