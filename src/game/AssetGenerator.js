/**
 * AssetGenerator — создаёт процедурные текстуры для Phaser.
 * Все игровые объекты рисуются локально, без внешних URL.
 */

export function generateAssets(scene) {
  const g = scene.make.graphics({ add: false });

  // Плитка асфальта
  g.clear();
  g.fillStyle(0x3a3a4a);
  g.fillRect(0, 0, 64, 64);
  g.fillStyle(0x333344);
  g.fillRect(0, 0, 32, 32);
  g.fillRect(32, 32, 32, 32);
  // Мелкие детали
  g.fillStyle(0x2e2e3e);
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * 60;
    const y = Math.random() * 60;
    g.fillRect(x, y, 2, 2);
  }
  g.generateTexture('tile_asphalt', 64, 64);

  // Плитка бетона
  g.clear();
  g.fillStyle(0x555566);
  g.fillRect(0, 0, 64, 64);
  g.lineStyle(1, 0x4a4a5a);
  g.strokeRect(1, 1, 62, 62);
  g.generateTexture('tile_concrete', 64, 64);

  // Здание автомойки (изометрическое)
  g.clear();
  // Крыша
  g.fillStyle(0x2a4a6a);
  g.fillTriangle(100, 0, 200, 50, 0, 50);
  // Стена фронтальная
  g.fillStyle(0x1e3450);
  g.fillRect(10, 50, 180, 80);
  // Окна
  g.fillStyle(0x66cccc);
  g.fillRect(30, 60, 30, 25);
  g.fillRect(80, 60, 30, 25);
  g.fillRect(130, 60, 30, 25);
  // Дверь
  g.fillStyle(0x0a8f8f);
  g.fillRect(85, 95, 30, 35);
  // Вывеска
  g.fillStyle(0xf0932b);
  g.fillRect(40, 40, 120, 15);
  g.generateTexture('building', 200, 130);

  // Моечный пост
  g.clear();
  // Основание
  g.fillStyle(0x445566);
  g.fillRect(0, 0, 80, 60);
  g.lineStyle(2, 0x00d2d3);
  g.strokeRect(0, 0, 80, 60);
  // Оборудование на стене
  g.fillStyle(0x667788);
  g.fillRect(2, 5, 10, 15);
  g.fillRect(2, 25, 10, 15);
  // Сток
  g.fillStyle(0x334455);
  g.fillRect(15, 50, 50, 8);
  g.generateTexture('wash_post', 80, 60);

  // Пост сломан
  g.clear();
  g.fillStyle(0x553333);
  g.fillRect(0, 0, 80, 60);
  g.lineStyle(2, 0xff6b6b);
  g.strokeRect(0, 0, 80, 60);
  g.fillStyle(0xff6b6b);
  g.fillRect(2, 5, 10, 15);
  g.fillRect(2, 25, 10, 15);
  g.fillStyle(0x442222);
  g.fillRect(15, 50, 50, 8);
  g.generateTexture('wash_post_broken', 80, 60);

  // Персонаж (вид сверху/изометрический)
  g.clear();
  // Тело
  g.fillStyle(0x3498db);
  g.fillRoundedRect(4, 8, 16, 20, 3);
  // Голова
  g.fillStyle(0xf5cba7);
  g.fillCircle(12, 6, 6);
  // Каска / кепка
  g.fillStyle(0x00d2d3);
  g.fillRect(6, 1, 12, 5);
  g.generateTexture('player', 24, 28);

  // Автомобили (4 класса)
  _generateCar(g, 'car_compact', 0x4a90d9, 32, 20);
  _generateCar(g, 'car_sedan', 0x7ed321, 38, 22);
  _generateCar(g, 'car_suv', 0x9b59b6, 42, 26);
  _generateCar(g, 'car_premium', 0xf39c12, 44, 24);

  // Грязная версия
  _generateCar(g, 'car_compact_dirty', 0x4a90d9, 32, 20, true);
  _generateCar(g, 'car_sedan_dirty', 0x7ed321, 38, 22, true);
  _generateCar(g, 'car_suv_dirty', 0x9b59b6, 42, 26, true);
  _generateCar(g, 'car_premium_dirty', 0xf39c12, 44, 24, true);

  // Пена
  _generateCar(g, 'car_compact_foam', 0x4a90d9, 32, 20, false, true);
  _generateCar(g, 'car_sedan_foam', 0x7ed321, 38, 22, false, true);
  _generateCar(g, 'car_suv_foam', 0x9b59b6, 42, 26, false, true);
  _generateCar(g, 'car_premium_foam', 0xf39c12, 44, 24, false, true);

  // Дорога
  g.clear();
  g.fillStyle(0x3a3a4a);
  g.fillRect(0, 0, 64, 64);
  // Разметка
  g.fillStyle(0xcccc55);
  g.fillRect(28, 0, 4, 20);
  g.fillRect(28, 35, 4, 20);
  g.generateTexture('tile_road', 64, 64);

  // Вывеска
  g.clear();
  g.fillStyle(0x0a8f8f);
  g.fillRect(0, 0, 120, 30);
  g.lineStyle(2, 0x00d2d3);
  g.strokeRect(0, 0, 120, 30);
  g.fillStyle(0xf0932b);
  g.fillRect(5, 5, 8, 20);
  g.generateTexture('sign', 120, 30);

  // Кнопка взаимодействия (E)
  g.clear();
  g.fillStyle(0x00d2d3);
  g.fillCircle(16, 16, 14);
  g.fillStyle(0x1a1a2e);
  g.fillRect(9, 9, 10, 3);
  g.fillRect(9, 13, 7, 3);
  g.fillRect(9, 17, 10, 3);
  g.generateTexture('interact_icon', 32, 32);

  // Стрелка/указатель очереди
  g.clear();
  g.fillStyle(0xf0932b);
  g.fillTriangle(8, 0, 16, 16, 0, 16);
  g.generateTexture('queue_arrow', 16, 16);

  g.destroy();
}

function _generateCar(g, key, baseColor, w, h, dirty = false, foam = false) {
  g.clear();

  // Тень
  g.fillStyle(0x111122);
  g.globalAlpha = 0.3;
  g.fillRoundedRect(3, 3, w, h, 4);
  g.globalAlpha = 1;

  // Кузов
  let bodyColor = baseColor;
  if (dirty) {
    // Затемняем для грязи
    const r = ((baseColor >> 16) & 0xff) * 0.6;
    const gr = ((baseColor >> 8) & 0xff) * 0.6;
    const b = (baseColor & 0xff) * 0.6;
    bodyColor = (Math.round(r) << 16) | (Math.round(gr) << 8) | Math.round(b);
  }

  g.fillStyle(bodyColor);
  g.fillRoundedRect(0, 0, w, h, 4);

  // Крыша/кабина
  const cabW = w * 0.5;
  const cabH = h * 0.6;
  const cabX = (w - cabW) / 2;
  const cabY = (h - cabH) / 2 - 1;
  g.fillStyle(foam ? 0xeeeeff : (dirty ? 0x333344 : 0x88bbdd));
  g.fillRoundedRect(cabX, cabY, cabW, cabH, 2);

  if (dirty) {
    // Пятна грязи
    g.fillStyle(0x554422);
    g.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      const dx = Math.random() * (w - 6);
      const dy = Math.random() * (h - 4);
      g.fillCircle(dx + 3, dy + 2, 2 + Math.random() * 2);
    }
    g.globalAlpha = 1;
  }

  if (foam) {
    // Пена
    g.fillStyle(0xffffff);
    g.globalAlpha = 0.7;
    for (let i = 0; i < 8; i++) {
      const dx = Math.random() * (w - 4);
      const dy = Math.random() * (h - 4);
      g.fillCircle(dx + 2, dy + 2, 2 + Math.random() * 3);
    }
    g.globalAlpha = 1;
  }

  // Колёса
  g.fillStyle(0x222233);
  g.fillCircle(6, 1, 3);
  g.fillCircle(w - 6, 1, 3);
  g.fillCircle(6, h - 1, 3);
  g.fillCircle(w - 6, h - 1, 3);

  g.generateTexture(key, w + 4, h + 4);
}

export default generateAssets;
