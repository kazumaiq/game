/**
 * MenuScene — главное меню.
 * Управляется через DOM overlay для гибкости и адаптивности.
 */
import saveSystem from '../systems/SaveSystem.js';
import gameState from '../systems/GameState.js';
import { showMenu, hideMenu } from '../../ui/MenuUI.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#0b0e14');

    this._particles = [];
    for (let i = 0; i < 24; i++) {
      const p = this.add.circle(
        Math.random() * width,
        Math.random() * height,
        1 + Math.random() * 2,
        0x00d2d3,
        0.15 + Math.random() * 0.25
      );
      p._speed = 0.2 + Math.random() * 0.5;
      this._particles.push(p);
    }

    const hasSave = saveSystem.hasSave();
    showMenu({
      hasSave,
      onNewGame: () => this._startNew(),
      onContinue: () => this._continue(),
    });
  }

  update() {
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

  shutdown() {
    this._particles = [];
    hideMenu();
  }
}
