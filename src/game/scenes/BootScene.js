/**
 * BootScene — загрузка и генерация ресурсов.
 */
import { generateAssets } from '../AssetGenerator.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Показываем прогресс-бар
    const { width, height } = this.cameras.main;
    const bar = this.add.graphics();
    const box = this.add.graphics();

    box.fillStyle(0x1e1e3a);
    box.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

    this.load.on('progress', (value) => {
      bar.clear();
      bar.fillStyle(0x00d2d3);
      bar.fillRect(width / 2 - 155, height / 2 - 10, 310 * value, 20);
    });

    this.load.on('complete', () => {
      bar.destroy();
      box.destroy();
    });

    // Нет внешних файлов — всё генерируется процедурно
    // Но делаем фейковую загрузку для индикатора
    this.load.image({ key: '__placeholder__', url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' });
  }

  create() {
    // Генерируем все текстуры процедурно
    generateAssets(this);

    // Переход в меню
    this.scene.start('MenuScene');
  }
}
