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

  const game = new Phaser.Game(config);

  // Optional on-device FPS probe: append ?debugFps=1 to the preview URL.
  // It is completely absent in normal play and reports Phaser's measured loop rate.
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debugFps') === '1') {
      const badge = document.createElement('div');
      badge.id = 'carwash-fps-debug';
      badge.style.cssText = [
        'position:fixed',
        'top:calc(env(safe-area-inset-top, 0px) + 8px)',
        'right:8px',
        'z-index:99999',
        'pointer-events:none',
        'padding:6px 9px',
        'border:1px solid rgba(125,211,252,.45)',
        'border-radius:9px',
        'background:rgba(3,10,20,.86)',
        'color:#a5f3fc',
        'font:700 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace',
        'letter-spacing:.03em',
      ].join(';');
      badge.textContent = 'FPS -- · DPR ' + dpr + '×';
      document.body.appendChild(badge);
      const timer = window.setInterval(() => {
        if (!badge.isConnected) {
          window.clearInterval(timer);
          return;
        }
        const fps = Math.round(game.loop.actualFps || 0);
        badge.textContent = 'FPS ' + fps + ' · DPR ' + dpr + '×';
        badge.style.color = fps >= 58 ? '#86efac' : fps >= 48 ? '#fde68a' : '#fda4af';
      }, 500);
      game.events.once('destroy', () => window.clearInterval(timer));
    }
  } catch {
    // Diagnostics must never prevent the game from starting in restricted browsers.
  }

  return game;
}
