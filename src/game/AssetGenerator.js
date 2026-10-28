/**
 * AssetGenerator — высококачественная процедурная графика в стиле 2.5D Isometric Tycoon.
 * Четкие пропорции, высокое разрешение, различимые элементы кузова, диски, стекла,
 * контрастная униформа и объемные боксы с навесом.
 */

export function generateAssets(scene) {
  const g = scene.make.graphics({ add: false });

  // 1. Асфальтовое покрытие автомойки (глубокий графит с легкой зернистостью)
  g.clear();
  g.fillStyle(0x1a1d24);
  g.fillRect(0, 0, 128, 128);
  g.fillStyle(0x232730);
  for (let i = 0; i < 35; i++) {
    const rx = (i * 19) % 126;
    const ry = (i * 29) % 126;
    g.fillRect(rx, ry, 2, 2);
  }
  g.generateTexture('asphalt_ground', 128, 128);

  // 2. Дорожное полотно с разделительной полосой
  g.clear();
  g.fillStyle(0x14161c);
  g.fillRect(0, 0, 128, 80);
  g.fillStyle(0xf1f5f9);
  g.fillRect(15, 38, 32, 4);
  g.fillRect(80, 38, 32, 4);
  g.fillStyle(0x475569);
  g.fillRect(0, 0, 128, 4);
  g.generateTexture('road_strip', 128, 80);

  // 3. Газон
  g.clear();
  g.fillStyle(0x1b4332);
  g.fillRect(0, 0, 64, 64);
  g.fillStyle(0x2d6a4f);
  g.fillRect(4, 4, 26, 26);
  g.fillRect(36, 36, 26, 26);
  g.generateTexture('lawn_tile', 64, 64);

  // 4. Главное здание администрации автомойки
  _generateBuilding(g);

  // 5. Моечный бокс (Увеличенный, пропорциональный, контрастный)
  _generateWashBay(g, 'wash_bay_normal', false);
  _generateWashBay(g, 'wash_bay_broken', true);

  // 6. Персонаж оператора в четкой униформе с различимыми фазами движения
  _generateCharacter(g, 'player_idle', 0);
  _generateCharacter(g, 'player_walk_1', 1);
  _generateCharacter(g, 'player_walk_2', 2);
  _generateCharacter(g, 'player_work', 3);

  // 7. Автомобили увеличенного масштаба: 4 класса x 3 состояния
  // Размеры: w ~ 100-125, h ~ 52-62 (вместо мелких 68х36)
  const carTypes = [
    { id: 'compact', w: 104, h: 52, baseColor: 0x2563eb, roofColor: 0x1d4ed8 }, // Синий городской хэтчбек
    { id: 'sedan', w: 118, h: 56, baseColor: 0x059669, roofColor: 0x047857 },   // Зеленый седан
    { id: 'suv', w: 126, h: 64, baseColor: 0x7c3aed, roofColor: 0x6d28d9 },     // Фиолетовый внедорожник
    { id: 'premium', w: 132, h: 58, baseColor: 0xd97706, roofColor: 0xb45309 }, // Золотистый люкс-седан
  ];

  for (const car of carTypes) {
    _generateCar(g, `car_${car.id}`, car, 'clean');
    _generateCar(g, `car_${car.id}_dirty`, car, 'dirty');
    _generateCar(g, `car_${car.id}_foam`, car, 'foam');
  }

  // 8. Декорации
  _generateDecorations(g);

  g.destroy();
}

function _generateBuilding(g) {
  g.clear();
  const W = 320;
  const H = 170;

  // Тень под зданием
  g.fillStyle(0x0a0c10, 0.5);
  g.fillRoundedRect(6, 12, W - 12, H - 12, 12);

  // Стены
  g.fillStyle(0x1e293b);
  g.fillRoundedRect(10, 20, W - 20, H - 24, 8);
  g.fillStyle(0x0f172a);
  g.fillRect(16, 42, W - 32, H - 50);

  // Крыша с бирюзовой подсветкой
  g.fillStyle(0x334155);
  g.fillRect(6, 14, W - 12, 26);
  g.fillStyle(0x00d2d3);
  g.fillRect(6, 12, W - 12, 4);

  // Панорамные витринные окна с теплым светом
  g.fillStyle(0xfef08a, 0.9);
  g.fillRoundedRect(28, 50, 96, 62, 4);
  g.fillRoundedRect(138, 50, 84, 62, 4);

  // Переплет
  g.lineStyle(2, 0x1e293b, 1);
  g.strokeRect(28, 50, 96, 62);
  g.strokeLineShape(new Phaser.Geom.Line(76, 50, 76, 112));
  g.strokeLineShape(new Phaser.Geom.Line(138, 81, 222, 81));

  // Отражения
  g.fillStyle(0xffffff, 0.3);
  g.fillTriangle(32, 112, 80, 50, 98, 50);

  // Входная дверь
  g.fillStyle(0x0284c7);
  g.fillRoundedRect(236, 50, 54, 78, 4);
  g.fillStyle(0xbae6fd, 0.6);
  g.fillRect(245, 58, 36, 42);

  // Вывеска
  g.fillStyle(0x090d16);
  g.fillRoundedRect(50, 22, 220, 18, 4);
  g.lineStyle(1, 0x00d2d3, 0.9);
  g.strokeRoundedRect(50, 22, 220, 18, 4);
  g.fillStyle(0x00d2d3);
  g.fillRect(60, 28, 10, 6);
  g.fillStyle(0xffffff);
  g.fillRect(76, 29, 160, 4);

  g.generateTexture('building_complex', W, H);
}

function _generateWashBay(g, key, broken = false) {
  g.clear();
  const W = 180;
  const H = 130;

  // Бетонное основание бокса
  g.fillStyle(0x1e2330);
  g.fillRoundedRect(4, 4, W - 8, H - 8, 8);

  // Сигнальная разметка въезда
  for (let i = 0; i < 8; i++) {
    g.fillStyle(i % 2 === 0 ? 0xfacc15 : 0x0f172a);
    g.fillRect(10 + i * 20, H - 10, 20, 6);
  }

  // Дренажная решетка слива
  g.fillStyle(0x0a0d14);
  g.fillRect(32, 45, W - 64, 40);
  g.lineStyle(2, 0x475569, 0.9);
  for (let y = 48; y <= 82; y += 6) {
    g.strokeLineShape(new Phaser.Geom.Line(36, y, W - 36, y));
  }

  // Опоры навеса
  const postColor = broken ? 0xef4444 : 0x0284c7;
  g.fillStyle(0x334155);
  g.fillRect(8, 8, 16, H - 24);
  g.fillStyle(postColor);
  g.fillRect(11, 11, 10, H - 30);

  g.fillStyle(0x334155);
  g.fillRect(W - 24, 8, 16, H - 24);
  g.fillStyle(postColor);
  g.fillRect(W - 21, 11, 10, H - 30);

  // Крыша бокса
  g.fillStyle(0x1e293b);
  g.fillRect(6, 6, W - 12, 16);
  g.fillStyle(broken ? 0xef4444 : 0x00d2d3);
  g.fillRect(10, 8, W - 20, 4);

  // Аппарат на стене со шлангом
  g.fillStyle(0xd97706);
  g.fillRoundedRect(14, 30, 16, 28, 3);
  g.fillStyle(broken ? 0xff0000 : 0x22c55e);
  g.fillCircle(22, 38, 4);

  // Шланг
  g.lineStyle(3, 0x0ea5e9, 0.9);
  g.beginPath();
  g.moveTo(22, 58);
  g.lineTo(30, 70);
  g.lineTo(22, 82);
  g.lineTo(34, 94);
  g.strokePath();

  if (broken) {
    g.fillStyle(0xef4444);
    g.fillTriangle(W / 2, 18, W / 2 - 14, 40, W / 2 + 14, 40);
    g.fillStyle(0xffffff);
    g.fillRect(W / 2 - 2, 24, 4, 8);
    g.fillRect(W / 2 - 2, 34, 4, 3);
  }

  g.generateTexture(key, W, H);
}

function _generateCar(g, key, conf, state) {
  g.clear();
  const W = conf.w;
  const H = conf.h;

  // Контактная тень
  g.fillStyle(0x080a10, 0.55);
  g.fillEllipse(W / 2 + 3, H / 2 + 8, W * 0.95, H * 0.8);

  // Колеса с дисками
  const wheelW = 18;
  const wheelH = 12;
  const wheels = [
    { x: 16, y: 3 },
    { x: W - 26, y: 3 },
    { x: 16, y: H - 12 },
    { x: W - 26, y: H - 12 },
  ];

  for (const wh of wheels) {
    g.fillStyle(0x0f172a);
    g.fillRoundedRect(wh.x, wh.y, wheelW, wheelH, 4);
    g.fillStyle(0x94a3b8);
    g.fillRect(wh.x + 4, wh.y + 3, wheelW - 8, wheelH - 6);
  }

  // Кузов
  let bodyColor = conf.baseColor;
  if (state === 'dirty') {
    const r = ((conf.baseColor >> 16) & 0xff) * 0.5;
    const gr = ((conf.baseColor >> 8) & 0xff) * 0.5;
    const b = (conf.baseColor & 0xff) * 0.5;
    bodyColor = (Math.round(r) << 16) | (Math.round(gr) << 8) | Math.round(b);
  }

  g.fillStyle(bodyColor);
  g.fillRoundedRect(6, 6, W - 12, H - 14, 10);

  // Радиатор / передний бампер
  g.fillStyle(0x0f172a);
  g.fillRect(W - 9, 14, 5, H - 28);

  // Фары (передние белые LED)
  g.fillStyle(0xf0fdf4);
  g.fillRoundedRect(W - 10, 10, 6, 8, 2);
  g.fillRoundedRect(W - 10, H - 18, 6, 8, 2);

  // Задние фонари
  g.fillStyle(0xef4444);
  g.fillRect(6, 11, 4, 7);
  g.fillRect(6, H - 18, 4, 7);

  // Остекление кабины
  const cabW = W * 0.54;
  const cabH = H * 0.68;
  const cabX = W * 0.22;
  const cabY = (H - cabH) / 2;

  g.fillStyle(state === 'foam' ? 0xf8fafc : 0x091c32);
  g.fillRoundedRect(cabX, cabY, cabW, cabH, 6);

  // Крыша
  const roofW = cabW * 0.72;
  const roofH = cabH * 0.78;
  const roofX = cabX + (cabW - roofW) / 2;
  const roofY = cabY + (cabH - roofH) / 2;

  g.fillStyle(state === 'dirty' ? 0x1f2937 : conf.roofColor);
  g.fillRoundedRect(roofX, roofY, roofW, roofH, 4);

  // Блики
  if (state === 'clean') {
    g.fillStyle(0xffffff, 0.45);
    g.fillTriangle(cabX + 6, cabY + cabH - 4, cabX + cabW - 12, cabY + 4, cabX + cabW - 4, cabY + 4);
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(W - 32, 14, 14, 6);
  }

  // Грязь
  if (state === 'dirty') {
    g.fillStyle(0x451a03, 0.75);
    g.fillCircle(W * 0.22, H * 0.35, 6);
    g.fillCircle(W * 0.3, H * 0.65, 7);
    g.fillCircle(W * 0.74, H * 0.4, 8);
    g.fillCircle(W * 0.82, H * 0.7, 7);
    g.fillStyle(0x78350f, 0.65);
    g.fillRect(14, 10, 36, 8);
    g.fillRect(W - 36, H - 16, 26, 7);
  } else if (state === 'foam') {
    // Густая пена
    g.fillStyle(0xffffff, 0.95);
    for (let i = 0; i < 24; i++) {
      const fx = 10 + (i * 17) % (W - 20);
      const fy = 8 + (i * 11) % (H - 16);
      const rad = 4 + (i % 5);
      g.fillCircle(fx, fy, rad);
    }
  }

  g.generateTexture(key, W, H);
}

function _generateCharacter(g, key, frame = 0) {
  g.clear();
  const W = 42;
  const H = 54;

  // Контактная тень
  g.fillStyle(0x0a0c10, 0.45);
  g.fillEllipse(21, 48, 24, 10);

  let legOffset1 = 0;
  let legOffset2 = 0;
  if (frame === 1) { legOffset1 = -4; legOffset2 = 4; }
  if (frame === 2) { legOffset1 = 4; legOffset2 = -4; }

  // Ноги
  g.fillStyle(0x1e293b);
  g.fillRect(13, 30 + legOffset1, 7, 14);
  g.fillRect(22, 30 + legOffset2, 7, 14);

  // Ботинки
  g.fillStyle(0x0f172a);
  g.fillRect(12, 42 + legOffset1, 8, 6);
  g.fillRect(22, 42 + legOffset2, 8, 6);

  // Куртка униформы (яркая бирюзовая)
  g.fillStyle(0x0284c7);
  g.fillRoundedRect(10, 16, 22, 18, 4);

  // Светоотражающий жилет
  g.fillStyle(0xfacc15);
  g.fillRect(12, 20, 18, 4);
  g.fillRect(12, 28, 18, 3);

  // Руки
  g.fillStyle(0x0369a1);
  if (frame === 3) {
    g.fillRect(26, 17, 14, 6);
    g.fillStyle(0x475569);
    g.fillRect(38, 15, 6, 14);
  } else {
    g.fillRect(6, 17, 5, 12);
    g.fillRect(31, 17, 5, 12);
  }

  // Голова
  g.fillStyle(0xfbcfe8);
  g.fillCircle(21, 10, 7);

  // Каска / кепка
  g.fillStyle(0x00d2d3);
  g.fillRect(14, 4, 14, 6);
  g.fillRect(16, 2, 13, 4);

  g.generateTexture(key, W, H);
}

function _generateDecorations(g) {
  g.clear();
  g.fillStyle(0xf97316);
  g.fillTriangle(14, 2, 4, 26, 24, 26);
  g.fillStyle(0xffffff);
  g.fillRect(8, 13, 12, 4);
  g.fillStyle(0x1e293b);
  g.fillRect(2, 26, 24, 4);
  g.generateTexture('cone', 28, 32);

  g.clear();
  g.fillStyle(0x0f172a, 0.4);
  g.fillEllipse(20, 36, 28, 10);
  g.fillStyle(0x475569);
  g.fillRoundedRect(10, 22, 20, 16, 3);
  g.fillStyle(0x15803d);
  g.fillCircle(20, 14, 14);
  g.fillStyle(0x22c55e);
  g.fillCircle(18, 11, 10);
  g.generateTexture('potted_tree', 40, 42);

  g.clear();
  g.fillStyle(0x334155);
  g.fillRect(14, 6, 5, 58);
  g.fillRect(8, 6, 17, 5);
  g.fillStyle(0xfef08a);
  g.fillCircle(16, 11, 5);
  g.generateTexture('lamp_post', 32, 66);
}

export default generateAssets;
