import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LocationSelectScene from './scenes/LocationSelectScene.js';
import CarWashScene from './scenes/CarWashScene.js';

export function createGame() {
  // Вычисляем разрешение устройства с ограничением до 2 для оптимальной четкости без просадки FPS
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

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
      roundPixels: false,
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
