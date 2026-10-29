import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LocationSelectScene from './scenes/LocationSelectScene.js';
import CarWashScene from './scenes/CarWashScene.js';

export function createGame() {
  // Cap the internal render resolution at 2x on high-DPI phones. Rendering a 3x
  // canvas can quadruple pixel work versus 1.5x and cause heat/FPS drops in Safari.
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
    // Sharp enough on Retina, with a lower GPU fill-rate cost on mobile.
    resolution: dpr,
    fps: { target: 60, min: 30, forceSetTimeOut: false, deltaHistory: 10 },
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
