import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LocationSelectScene from './scenes/LocationSelectScene.js';
import CarWashScene from './scenes/CarWashScene.js';

export function createGame() {
  const isPortrait = window.innerHeight > window.innerWidth;
  // На мобильных устройствах ориентируемся на отзывчивый RESIZE с динамическим зумом и центровкой
  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    input: {
      activePointers: 3, // мультитач: стик + кнопка действия одновременно
    },
    backgroundColor: '#161623',
    scene: [BootScene, MenuScene, LocationSelectScene, CarWashScene],
  };

  return new Phaser.Game(config);
}
