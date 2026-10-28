/**
 * MenuScene — кинематографичная вечерняя сцена автомойки.
 * Рисует изометрическое здание, бокс с подсветкой, автомобиль в пене,
 * мокрый асфальт с отражениями, фонари и анимацию пара/капель.
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
    this.cameras.main.setBackgroundColor('#060a12');

    this._objects = [];

    // === ФОНОВЫЙ ГРАДИЕНТ: ночное небо → горизонт ===
    const skyGrad = this.add.graphics();
    const skyH = Math.floor(height * 0.45);
    for (let y = 0; y < skyH; y++) {
      const t = y / skyH;
      const r = Math.floor(6 + t * 8);
      const gg = Math.floor(10 + t * 14);
      const b = Math.floor(18 + t * 28);
      skyGrad.fillStyle(Phaser.Display.Color.GetColor(r, gg, b));
      skyGrad.fillRect(0, y, width, 1);
    }

    // === ЗВЁЗДЫ ===
    const starsGfx = this.add.graphics();
    for (let i = 0; i < 40; i++) {
      const sx = Math.random() * width;
      const sy = Math.random() * skyH * 0.7;
      const alpha = 0.15 + Math.random() * 0.45;
      const radius = 0.4 + Math.random() * 0.8;
      starsGfx.fillStyle(0xc8d6e5, alpha);
      starsGfx.fillCircle(sx, sy, radius);
    }

    // === ЛИНИЯ ГОРИЗОНТА / ГОРОДСКИЕ СИЛУЭТЫ ===
    const horizonY = skyH;
    const cityGfx = this.add.graphics();
    cityGfx.fillStyle(0x0c1220, 0.9);
    const buildingCount = Math.floor(width / 28) + 2;
    for (let i = 0; i < buildingCount; i++) {
      const bx = i * 28 - 10 + Math.random() * 6;
      const bh = 16 + Math.random() * 50;
      const bw = 12 + Math.random() * 20;
      cityGfx.fillRect(bx, horizonY - bh, bw, bh);
      // Окошки
      cityGfx.fillStyle(0x1a2744, 0.6);
      for (let wy = horizonY - bh + 4; wy < horizonY - 4; wy += 8) {
        for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) {
          if (Math.random() > 0.4) {
            cityGfx.fillStyle(0x243b5e, 0.4 + Math.random() * 0.3);
            cityGfx.fillRect(wx, wy, 3, 4);
          }
        }
      }
      cityGfx.fillStyle(0x0c1220, 0.9);
    }

    // === МОКРЫЙ АСФАЛЬТ ===
    const groundY = horizonY;
    const groundGfx = this.add.graphics();
    // Градиент мокрого асфальта
    for (let y = groundY; y < height; y++) {
      const t = (y - groundY) / (height - groundY);
      const r = Math.floor(14 + t * 8);
      const gg = Math.floor(18 + t * 10);
      const b = Math.floor(26 + t * 14);
      groundGfx.fillStyle(Phaser.Display.Color.GetColor(r, gg, b), 0.95);
      groundGfx.fillRect(0, y, width, 1);
    }
    // Блики на мокром асфальте
    const reflGfx = this.add.graphics();
    for (let i = 0; i < 18; i++) {
      const rx = Math.random() * width;
      const ry = groundY + 20 + Math.random() * (height - groundY - 40);
      const rw = 12 + Math.random() * 40;
      reflGfx.fillStyle(0x0ea5e9, 0.03 + Math.random() * 0.04);
      reflGfx.fillRoundedRect(rx, ry, rw, 1, 0);
    }

    // === ЦЕНТРАЛЬНАЯ КОМПОЗИЦИЯ: ЗДАНИЕ АВТОМОЙКИ ===
    const centerX = width * 0.5;
    const bayY = groundY + (height - groundY) * 0.15;
    const bayW = Math.min(width * 0.7, 340);
    const bayH = Math.min((height - groundY) * 0.42, 140);
    const bayX = centerX - bayW / 2;

    const buildingGfx = this.add.graphics();

    // Крыша / навес
    buildingGfx.fillStyle(0x111827);
    buildingGfx.fillRoundedRect(bayX - 8, bayY - 18, bayW + 16, 22, 4);
    // Каркас тёмно-синий
    buildingGfx.fillStyle(0x0f172a);
    buildingGfx.fillRoundedRect(bayX, bayY, bayW, bayH, 6);
    // Внутренняя стена бокса
    buildingGfx.fillStyle(0x172236);
    buildingGfx.fillRoundedRect(bayX + 4, bayY + 4, bayW - 8, bayH - 8, 4);

    // Плиточный пол бокса
    buildingGfx.fillStyle(0x1e293b);
    for (let tx = bayX + 6; tx < bayX + bayW - 8; tx += 14) {
      for (let ty = bayY + bayH * 0.55; ty < bayY + bayH - 6; ty += 10) {
        buildingGfx.fillRect(tx, ty, 12, 8);
        buildingGfx.lineStyle(0.5, 0x334155, 0.4);
        buildingGfx.strokeRect(tx, ty, 12, 8);
      }
    }

    // === НЕОНОВАЯ ПОДСВЕТКА БОКСА ===
    const neonGfx = this.add.graphics();
    // Верхняя полоса
    neonGfx.fillStyle(0x0ea5e9, 0.7);
    neonGfx.fillRect(bayX + 10, bayY + 2, bayW - 20, 2);
    // Cyan glow
    neonGfx.fillStyle(0x0ea5e9, 0.1);
    neonGfx.fillRect(bayX + 10, bayY - 4, bayW - 20, 12);
    // Боковые полоски
    neonGfx.fillStyle(0x0ea5e9, 0.5);
    neonGfx.fillRect(bayX + 4, bayY + 6, 2, bayH - 12);
    neonGfx.fillRect(bayX + bayW - 6, bayY + 6, 2, bayH - 12);
    this._neonGfx = neonGfx;

    // === АВТОМОБИЛЬ В БОКСЕ (ПЕНА) ===
    const carW = Math.min(bayW * 0.55, 160);
    const carH = carW * 0.45;
    const carX = centerX - carW / 2;
    const carY = bayY + bayH * 0.32;

    const carGfx = this.add.graphics();
    // Тень под машиной
    carGfx.fillStyle(0x000000, 0.3);
    carGfx.fillEllipse(centerX, carY + carH + 4, carW * 0.9, 10);

    // Кузов — тёмно-синий / индиго
    carGfx.fillStyle(0x1e3a5f);
    carGfx.fillRoundedRect(carX, carY + carH * 0.3, carW, carH * 0.55, 6);
    // Крыша
    carGfx.fillStyle(0x162d4d);
    carGfx.fillRoundedRect(carX + carW * 0.15, carY, carW * 0.55, carH * 0.45, 5);
    // Стёкла
    carGfx.fillStyle(0x38bdf8, 0.25);
    carGfx.fillRoundedRect(carX + carW * 0.18, carY + 4, carW * 0.22, carH * 0.3, 3);
    carGfx.fillRoundedRect(carX + carW * 0.44, carY + 4, carW * 0.22, carH * 0.3, 3);
    // Фары
    carGfx.fillStyle(0xfef08a, 0.8);
    carGfx.fillCircle(carX + 6, carY + carH * 0.55, 4);
    carGfx.fillCircle(carX + carW - 6, carY + carH * 0.55, 3);
    // Колёса
    carGfx.fillStyle(0x0f172a);
    carGfx.fillCircle(carX + carW * 0.2, carY + carH * 0.85, 7);
    carGfx.fillCircle(carX + carW * 0.8, carY + carH * 0.85, 7);
    carGfx.fillStyle(0x334155);
    carGfx.fillCircle(carX + carW * 0.2, carY + carH * 0.85, 4);
    carGfx.fillCircle(carX + carW * 0.8, carY + carH * 0.85, 4);

    // Пена на машине
    const foamGfx = this.add.graphics();
    this._foamBubbles = [];
    for (let i = 0; i < 22; i++) {
      const bx = carX + 10 + Math.random() * (carW - 20);
      const by = carY + 2 + Math.random() * (carH * 0.7);
      const br = 2 + Math.random() * 5;
      const balpha = 0.25 + Math.random() * 0.35;
      this._foamBubbles.push({ x: bx, y: by, r: br, a: balpha, phase: Math.random() * Math.PI * 2 });
    }
    this._foamGfx = foamGfx;

    // === ВЫВЕСКА НАД БОКСОМ ===
    const signY = bayY - 40;
    const signGfx = this.add.graphics();
    // Подложка
    signGfx.fillStyle(0x0f172a, 0.9);
    signGfx.fillRoundedRect(centerX - 70, signY, 140, 22, 4);
    signGfx.lineStyle(1, 0x0ea5e9, 0.6);
    signGfx.strokeRoundedRect(centerX - 70, signY, 140, 22, 4);

    const signText = this.add.text(centerX, signY + 11, 'PREMIUM WASH', {
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#67e8f9',
      align: 'center',
    }).setOrigin(0.5);

    // === ФОНАРИ ===
    const lampGfx = this.add.graphics();
    const lampPositions = [
      { x: bayX - 30, y: bayY + 10 },
      { x: bayX + bayW + 30, y: bayY + 10 },
    ];
    for (const lp of lampPositions) {
      // Столб
      lampGfx.fillStyle(0x475569);
      lampGfx.fillRect(lp.x - 2, lp.y, 4, bayH - 10);
      // Лампа
      lampGfx.fillStyle(0xfef08a, 0.85);
      lampGfx.fillCircle(lp.x, lp.y - 2, 5);
      // Световой круг
      lampGfx.fillStyle(0xfef08a, 0.04);
      lampGfx.fillCircle(lp.x, lp.y + 20, 40);
    }

    // === КАПЛИ / ВОДЯНОЙ ПАР (анимированные частицы) ===
    this._waterParticles = [];
    const particleGfx = this.add.graphics();
    this._particleGfx = particleGfx;

    for (let i = 0; i < 30; i++) {
      this._waterParticles.push({
        x: bayX + Math.random() * bayW,
        y: bayY + Math.random() * bayH,
        vy: -0.2 - Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 0.3,
        r: 0.5 + Math.random() * 1.5,
        a: 0.1 + Math.random() * 0.25,
        life: Math.random() * 100,
      });
    }

    // Сохраняем границы бокса для респавна
    this._bayBounds = { x: bayX, y: bayY, w: bayW, h: bayH };

    // === МЕЛКАЯ ДОЖДЕВАЯ ПЫЛЬ ===
    this._rainDrops = [];
    this._rainGfx = this.add.graphics();
    for (let i = 0; i < 35; i++) {
      this._rainDrops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 1.5 + Math.random() * 2.5,
        len: 4 + Math.random() * 8,
      });
    }

    // === МЕРЦАНИЕ НЕОНА (таймер) ===
    this._neonFlicker = 0;

    // === ПОКАЗЫВАЕМ МЕНЮ ===
    const hasSave = saveSystem.hasSave();
    showMenu({
      hasSave,
      onNewGame: () => this._startNew(),
      onContinue: () => this._continue(),
    });
  }

  update(time, delta) {
    const dt = delta / 16.67; // нормализация к 60fps

    // Пена — пульсация
    if (this._foamGfx) {
      this._foamGfx.clear();
      for (const b of this._foamBubbles) {
        b.phase += 0.02 * dt;
        const scale = 1 + Math.sin(b.phase) * 0.2;
        this._foamGfx.fillStyle(0xffffff, b.a * (0.8 + Math.sin(b.phase * 1.5) * 0.2));
        this._foamGfx.fillCircle(b.x, b.y, b.r * scale);
      }
    }

    // Водяной пар — поднимается и исчезает
    if (this._particleGfx) {
      this._particleGfx.clear();
      const bay = this._bayBounds;
      for (const p of this._waterParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life += dt;
        if (p.y < bay.y - 20 || p.life > 120) {
          p.x = bay.x + Math.random() * bay.w;
          p.y = bay.y + bay.h * 0.3 + Math.random() * bay.h * 0.5;
          p.life = 0;
        }
        const fadeA = p.a * Math.max(0, 1 - p.life / 120);
        this._particleGfx.fillStyle(0xcfefff, fadeA);
        this._particleGfx.fillCircle(p.x, p.y, p.r);
      }
    }

    // Мелкий дождь
    if (this._rainGfx) {
      this._rainGfx.clear();
      this._rainGfx.lineStyle(0.5, 0x64748b, 0.15);
      const h = this.cameras.main.height;
      for (const d of this._rainDrops) {
        d.y += d.speed * dt;
        if (d.y > h) {
          d.y = -d.len;
          d.x = Math.random() * this.cameras.main.width;
        }
        this._rainGfx.lineBetween(d.x, d.y, d.x - 0.5, d.y + d.len);
      }
    }

    // Мерцание неона
    if (this._neonGfx) {
      this._neonFlicker += 0.03 * dt;
      const flick = 0.85 + Math.sin(this._neonFlicker * 3) * 0.1 + Math.sin(this._neonFlicker * 7.3) * 0.05;
      this._neonGfx.setAlpha(flick);
    }
  }

  _startNew() {
    if (this._transitioning) return;
    if (saveSystem.hasSave()) {
      if (!confirm('Начать новую игру? Текущий прогресс будет перезаписан.')) return;
    }
    this._transitioning = true;
    saveSystem.deleteSave();
    hideMenu();
    this.scene.start('LocationSelectScene');
  }

  _continue() {
    if (this._transitioning) return;
    const result = saveSystem.load();
    if (!result.success) {
      if (result.reason === 'corrupt') {
        alert('Сохранение повреждено. Начните новую игру.');
      }
      return;
    }
    this._transitioning = true;
    hideMenu();
    this.scene.start('CarWashScene');
  }

  shutdown() {
    this._foamBubbles = [];
    this._waterParticles = [];
    this._rainDrops = [];
    hideMenu();
  }
}
