/**
 * MenuScene — главное меню.
 * Управляется через DOM overlay для гибкости и простоты.
 */
import saveSystem from '../systems/SaveSystem.js';
import gameState from '../systems/GameState.js';
import { showMenu, hideMenu } from '../../ui/MenuUI.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    // Фон
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Анимированные фоновые частицы
    this._particles = [];
    for (let i = 0; i < 20; i++) {
      const p = this.add.circle(
        Math.random() * width,
        Math.random() * height,
        1 + Math.random() * 2,
        0x00d2d3,
        0.15 + Math.random() * 0.2
      );
      p._speed = 0.2 + Math.random() * 0.5;
      this._particles.push(p);
    }

    // Показать DOM-меню
    const hasSave = saveSystem.hasSave();
    showMenu({
      hasSave,
      onNewGame: () => this._startNew(),
      onContinue: () => this._continue(),
      onFullscreen: () => this._toggleFullscreen(),
    });
  }

  update() {
    // Двигаем частицы
    for (const p of this._particles) {
      p.y -= p._speed;
      if (p.y < -10) {
        p.y = this.cameras.main.height + 10;
        p.x = Math.random() * this.cameras.main.width;
      }
    }
  }

  _startNew() {
    if (saveSystem.hasSave()) {
      if (!confirm('Начать новую игру? Текущий прогресс будет перезаписан.')) return;
    }
    saveSystem.deleteSave();
    hideMenu();
    this.scene.start('LocationSelectScene');
  }

  _continue() {
    const result = saveSystem.load();
    if (!result.success) {
      if (result.reason === 'corrupt') {
        alert('Сохранение повреждено. Начните новую игру.');
      }
      return;
    }
    hideMenu();
    this.scene.start('CarWashScene');
  }

  _toggleFullscreen() {
    try {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      } else {
        this.scale.startFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen not available:', e);
    }
  }

  shutdown() {
    this._particles = [];
    hideMenu();
  }
}
