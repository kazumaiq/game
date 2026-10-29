import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LocationSelectScene from './scenes/LocationSelectScene.js';
import CarWashScene from './scenes/CarWashScene.js';

export function createGame() {
  // Используем полный Retina DPR на телефонах (iPhone обычно 3x), ограничивая только экраны выше 3x.
  // Это повышает чёткость Phaser-текста, тонких линий и процедурных текстур на мобильных устройствах.
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Установка devicePixelRatio для четкого рендеринга на Retina / OLED экранах телефонов
    resolution: dpr,
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
      powerPreference: 'high-performance',
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    input: {
      activePointers: 3, // мультитач
    },
    backgroundColor: '#0b0e14',
    scene: [BootScene, MenuScene, LocationSelectScene, CarWashScene],
  };

  return new Phaser.Game(config);
}
