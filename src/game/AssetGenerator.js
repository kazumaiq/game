/**
 * AssetGenerator — высококачественная процедурная графика в стиле 2.5D Isometric Tycoon.
 * Прорисовываются кузовы с перспективой, фары, бамперы, окна, тени, пена, грязь,
 * боксы автомойки с навесами и оборудованием, персонажи с униформой и окружение.
 */

export function generateAssets(scene) {
  const g = scene.make.graphics({ add: false });

  // 1. Асфальтовое покрытие автомойки (чистый темный асфальт с легким градиентом)
  g.clear();
  g.fillStyle(0x1e2029);
  g.fillRect(0, 0, 128, 128);
  // Легкая текстура зернистости
  g.fillStyle(0x272a36);
  for (let i = 0; i < 40; i++) {
    const rx = (i * 17) % 126;
    const ry = (i * 31) % 126;
    g.fillRect(rx, ry, 2, 2);
  }
  g.fillStyle(0x161820);
  for (let i = 0; i < 25; i++) {
    const rx = (i * 23) % 126;
    const ry = (i * 19) % 126;
    g.fillRect(rx, ry, 1, 2);
  }
  g.generateTexture('asphalt_ground', 128, 128);

  // 2. Дорожное полотно с белой разметкой
  g.clear();
  g.fillStyle(0x181a22);
  g.fillRect(0, 0, 128, 80);
  // Белая пунктирная полоса по центру
  g.fillStyle(0xe2e8f0);
  g.fillRect(15, 38, 30, 4);
  g.fillRect(80, 38, 30, 4);
  // Бордюр сверху
  g.fillStyle(0x475569);
  g.fillRect(0, 0, 128, 5);
  g.fillStyle(0x94a3b8);
  g.fillRect(0, 5, 128, 2);
  g.generateTexture('road_strip', 128, 80);

  // 3. Тротуарная плитка и газон для окружения
  g.clear();
  g.fillStyle(0x2d3748);
  g.fillRect(0, 0, 64, 64);
  g.lineStyle(1, 0x1a202c, 0.7);
  g.strokeRect(1, 1, 62, 62);
  g.strokeRect(1, 1, 30, 30);
  g.strokeRect(33, 33, 30, 30);
  g.generateTexture('sidewalk_tile', 64, 64);

  g.clear();
  g.fillStyle(0x1b4332);
  g.fillRect(0, 0, 64, 64);
  g.fillStyle(0x2d6a4f);
  g.fillRect(4, 4, 24, 24);
  g.fillRect(36, 36, 24, 24);
  g.fillStyle(0x40916c);
  for (let i = 0; i < 12; i++) {
    g.fillCircle((i * 11) % 60 + 2, (i * 17) % 60 + 2, 2);
  }
  g.generateTexture('lawn_tile', 64, 64);

  // 4. Главное здание администрации автомойки (Изометрическое, многоуровневое со стеклом)
  _generateBuilding(g);

  // 5. Моечный бокс (Навес с металлическими балками, шлангами, пультами и дренажной решеткой)
  _generateWashBay(g, 'wash_bay_normal', false);
  _generateWashBay(g, 'wash_bay_broken', true);

  // 6. Персонаж оператора в качественной рабочей униформе
  _generateCharacter(g, 'player_idle', 0);
  _generateCharacter(g, 'player_walk_1', 1);
  _generateCharacter(g, 'player_walk_2', 2);
  _generateCharacter(g, 'player_work', 3);

  // 7. Автомобили: 4 класса x 3 состояния (грязный, в пене, чистый премиальный вид)
  // Размеры: w, h
  const carTypes = [
    { id: 'compact', w: 68, h: 36, baseColor: 0x3b82f6, roofColor: 0x2563eb }, // Синий хэтчбек
    { id: 'sedan', w: 80, h: 40, baseColor: 0x10b981, roofColor: 0x059669 },   // Изумрудный седан
    { id: 'suv', w: 88, h: 46, baseColor: 0x8b5cf6, roofColor: 0x7c3aed },     // Фиолетовый внедорожник
    { id: 'premium', w: 94, h: 42, baseColor: 0xf59e0b, roofColor: 0xd97706 }, // Золотисто-янтарный седан люкс
  ];

  for (const car of carTypes) {
    // Чистая машина
    _generateCar(g, `car_${car.id}`, car, 'clean');
    // Грязная машина
    _generateCar(g, `car_${car.id}_dirty`, car, 'dirty');
    // Покрытая пеной машина
    _generateCar(g, `car_${car.id}_foam`, car, 'foam');
  }

  // 8. Декоративные объекты: вывеска, парковочный конус, фонарный столб, дерево в кадке
  _generateDecorations(g);

  g.destroy();
}

/** Отрисовка современного здания сервиса */
function _generateBuilding(g) {
  g.clear();
  const W = 280;
  const H = 160;

  // Тень под зданием
  g.fillStyle(0x0c0e14, 0.45);
  g.fillRoundedRect(8, 12, W - 10, H - 10, 12);

  // Основание/Стены здания (глубокий индиго/графит)
  g.fillStyle(0x1e293b);
  g.fillRoundedRect(10, 20, W - 20, H - 24, 8);

  // Лицевая отделка панелями
  g.fillStyle(0x0f172a);
  g.fillRect(16, 40, W - 32, H - 46);

  // Козырек / Крыша (с бирюзовым кантом)
  g.fillStyle(0x334155);
  g.fillRect(6, 14, W - 12, 24);
  g.fillStyle(0x00d2d3);
  g.fillRect(6, 12, W - 12, 3);

  // Панорамные витринные окна с теплым внутренним светом
  g.fillStyle(0xfef08a, 0.85); // Тёплый свет в офисе
  g.fillRoundedRect(28, 48, 80, 52, 4);
  g.fillRoundedRect(120, 48, 70, 52, 4);

  // Переплет окон
  g.lineStyle(2, 0x1e293b, 1);
  g.strokeRect(28, 48, 80, 52);
  g.strokeLineShape(new Phaser.Geom.Line(68, 48, 68, 100));
  g.strokeLineShape(new Phaser.Geom.Line(120, 74, 190, 74));

  // Отражения на стекле
  g.fillStyle(0xffffff, 0.25);
  g.fillTriangle(32, 100, 70, 48, 85, 48);

  // Входная дверь со стеклом
  g.fillStyle(0x0284c7);
  g.fillRoundedRect(204, 48, 48, 68, 4);
  g.fillStyle(0xbae6fd, 0.5);
  g.fillRect(212, 54, 32, 36);

  // Вывеска с подсветкой на фризе
  g.fillStyle(0x090d16);
  g.fillRoundedRect(44, 22, 190, 16, 4);
  g.lineStyle(1, 0x00d2d3, 0.8);
  g.strokeRoundedRect(44, 22, 190, 16, 4);

  // Светящийся неон логотипа
  g.fillStyle(0x00d2d3);
  g.fillRect(52, 27, 8, 6);
  g.fillStyle(0xffffff);
  g.fillRect(65, 28, 140, 4);

  g.generateTexture('building_complex', W, H);
}

/** Отрисовка моечного бокса с колоннами, дренажом и оборудованием */
function _generateWashBay(g, key, broken = false) {
  g.clear();
  const W = 140;
  const H = 100;

  // 1. Пол бокса с наклоном и зоной слива воды
  g.fillStyle(0x1a1e29);
  g.fillRoundedRect(4, 4, W - 8, H - 8, 6);

  // Желто-черная сигнальная разметка въезда в бокс
  for (let i = 0; i < 6; i++) {
    g.fillStyle(i % 2 === 0 ? 0xfacc15 : 0x1e293b);
    g.fillRect(10 + i * 20, H - 9, 20, 5);
  }

  // Центральная металлическая решетка стока воды
  g.fillStyle(0x0f172a);
  g.fillRect(25, 35, W - 50, 30);
  g.lineStyle(1, 0x475569, 0.8);
  for (let y = 38; y <= 62; y += 4) {
    g.strokeLineShape(new Phaser.Geom.Line(28, y, W - 28, y));
  }

  // 2. Металлические опоры и навес
  const postColor = broken ? 0xef4444 : 0x0ea5e9;
  // Левая опора
  g.fillStyle(0x334155);
  g.fillRect(8, 8, 12, 80);
  g.fillStyle(postColor);
  g.fillRect(10, 10, 8, 76);

  // Правая опора
  g.fillStyle(0x334155);
  g.fillRect(W - 20, 8, 12, 80);
  g.fillStyle(postColor);
  g.fillRect(W - 18, 10, 8, 76);

  // Верхняя балка / шланг высокого давления
  g.fillStyle(0x1e293b);
  g.fillRect(8, 6, W - 16, 12);
  g.fillStyle(broken ? 0xef4444 : 0x00d2d3);
  g.fillRect(12, 8, W - 24, 3);

  // Моющий аппарат на стене
  g.fillStyle(0xd97706);
  g.fillRoundedRect(14, 25, 12, 22, 2);
  // Манометр / индикатор
  g.fillStyle(broken ? 0xff0000 : 0x22c55e);
  g.fillCircle(20, 31, 3);

  // Свисающий спиральный шланг
  g.lineStyle(2, 0x0284c7, 0.9);
  g.beginPath();
  g.moveTo(20, 48);
  g.lineTo(26, 56);
  g.lineTo(20, 64);
  g.lineTo(28, 72);
  g.strokePath();

  if (broken) {
    // Эффект поломки (предупредительный знак)
    g.fillStyle(0xef4444);
    g.fillTriangle(W / 2, 14, W / 2 - 10, 30, W / 2 + 10, 30);
    g.fillStyle(0xffffff);
    g.fillRect(W / 2 - 1, 19, 2, 6);
    g.fillRect(W / 2 - 1, 27, 2, 2);
  }

  g.generateTexture(key, W, H);
}

/** Отрисовка детализированного автомобиля в изометрии */
function _generateCar(g, key, conf, state) {
  g.clear();
  const W = conf.w;
  const H = conf.h;

  // 1. Мягкая контактная тень на асфальте под кузовом
  g.fillStyle(0x0a0c10, 0.45);
  g.fillEllipse(W / 2 + 3, H / 2 + 6, W * 0.94, H * 0.75);

  // 2. Колёса с дисками
  const wheelW = 12;
  const wheelH = 9;
  const wheels = [
    { x: 12, y: 3 },
    { x: W - 18, y: 3 },
    { x: 12, y: H - 9 },
    { x: W - 18, y: H - 9 }
  ];

  for (const wh of wheels) {
    g.fillStyle(0x0f172a); // Резина
    g.fillRoundedRect(wh.x, wh.y, wheelW, wheelH, 3);
    g.fillStyle(0x94a3b8); // Литой диск
    g.fillRect(wh.x + 3, wh.y + 2, wheelW - 6, wheelH - 4);
  }

  // 3. Основной кузов (аэродинамичный с бамперами)
  let bodyColor = conf.baseColor;
  if (state === 'dirty') {
    // Приглушаем цвет грязью
    const r = ((conf.baseColor >> 16) & 0xff) * 0.55;
    const gr = ((conf.baseColor >> 8) & 0xff) * 0.55;
    const b = (conf.baseColor & 0xff) * 0.55;
    bodyColor = (Math.round(r) << 16) | (Math.round(gr) << 8) | Math.round(b);
  }

  // Нижний контур кузова
  g.fillStyle(bodyColor);
  g.fillRoundedRect(4, 5, W - 8, H - 10, 7);

  // Решетка радиатора и передний бампер (справа по ходу движения)
  g.fillStyle(0x1e293b);
  g.fillRect(W - 7, 10, 4, H - 20);

  // Фары передние (светодиодные белые/голубые)
  g.fillStyle(0xe0f2fe);
  g.fillRoundedRect(W - 8, 7, 5, 6, 2);
  g.fillRoundedRect(W - 8, H - 13, 5, 6, 2);

  // Задние фонари (красные)
  g.fillStyle(0xef4444);
  g.fillRect(4, 8, 3, 5);
  g.fillRect(4, H - 13, 3, 5);

  // 4. Кабина, стойки и остекление
  const cabW = W * 0.52;
  const cabH = H * 0.65;
  const cabX = W * 0.22;
  const cabY = (H - cabH) / 2;

  // Лобовое, боковые и заднее стекла (глубокий оттенок тонировки)
  g.fillStyle(state === 'foam' ? 0xf8fafc : 0x0f2744);
  g.fillRoundedRect(cabX, cabY, cabW, cabH, 4);

  // Крыша автомобиля
  const roofW = cabW * 0.72;
  const roofH = cabH * 0.78;
  const roofX = cabX + (cabW - roofW) / 2;
  const roofY = cabY + (cabH - roofH) / 2;

  g.fillStyle(state === 'dirty' ? 0x242e38 : conf.roofColor);
  g.fillRoundedRect(roofX, roofY, roofW, roofH, 3);

  // Блик на стекле (аккуратная линия отражения)
  if (state === 'clean') {
    g.fillStyle(0xffffff, 0.45);
    g.fillTriangle(cabX + 4, cabY + cabH - 3, cabX + cabW - 8, cabY + 3, cabX + cabW - 2, cabY + 3);
    // Глянцевый блик на капоте
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(W - 22, 11, 10, 4);
  }

  // 5. Визуальные эффекты состояний: ГРЯЗЬ или ПЕНА
  if (state === 'dirty') {
    // Пятна дорожной грязи, брызги
    g.fillStyle(0x451a03, 0.7);
    g.fillCircle(W * 0.2, H * 0.35, 4);
    g.fillCircle(W * 0.28, H * 0.65, 5);
    g.fillCircle(W * 0.75, H * 0.4, 6);
    g.fillCircle(W * 0.82, H * 0.7, 5);
    g.fillStyle(0x78350f, 0.6);
    g.fillRect(10, 7, 24, 6);
    g.fillRect(W - 24, H - 12, 18, 5);
  } else if (state === 'foam') {
    // Шапка густой активной пены с пузырьками
    g.fillStyle(0xffffff, 0.92);
    for (let i = 0; i < 18; i++) {
      const fx = 8 + (i * 13) % (W - 16);
      const fy = 6 + (i * 9) % (H - 12);
      const rad = 3 + (i % 4);
      g.fillCircle(fx, fy, rad);
    }
    // Стекающая пена по бокам
    g.fillStyle(0xf1f5f9, 0.85);
    g.fillRoundedRect(cabX - 2, cabY - 1, cabW + 4, cabH + 2, 5);
  }

  g.generateTexture(key, W, H);
}

/** Отрисовка детализированного персонажа рабочего */
function _generateCharacter(g, key, frame = 0) {
  g.clear();
  const W = 32;
  const H = 40;

  // Тень под ногами
  g.fillStyle(0x0c0e14, 0.4);
  g.fillEllipse(16, 36, 18, 8);

  // Ноги / ботинки
  let legOffset1 = 0;
  let legOffset2 = 0;
  if (frame === 1) { legOffset1 = -3; legOffset2 = 3; }
  if (frame === 2) { legOffset1 = 3; legOffset2 = -3; }

  // Прочные рабочие штаны (темно-синие с наколенниками)
  g.fillStyle(0x1e293b);
  g.fillRect(10, 24 + legOffset1, 5, 9);
  g.fillRect(17, 24 + legOffset2, 5, 9);

  // Ботинки
  g.fillStyle(0x0f172a);
  g.fillRect(9, 32 + legOffset1, 6, 4);
  g.fillRect(17, 32 + legOffset2, 6, 4);

  // Тело / куртка униформы (бирюзово-серая с отражающей полосой)
  g.fillStyle(0x0ea5e9);
  g.fillRoundedRect(8, 12, 16, 14, 3);
  // Светоотражающая жилетка
  g.fillStyle(0xfacc15);
  g.fillRect(10, 15, 12, 3);
  g.fillRect(10, 21, 12, 2);

  // Руки и перчатки
  g.fillStyle(0x0284c7);
  if (frame === 3) {
    // В позе работы (вытянутые руки с моечным пистолетом)
    g.fillRect(20, 13, 10, 4);
    g.fillStyle(0x475569); // пистолет распылителя
    g.fillRect(28, 11, 4, 10);
  } else {
    g.fillRect(5, 13, 4, 9);
    g.fillRect(23, 13, 4, 9);
  }

  // Голова
  g.fillStyle(0xfbcfe8); // кожа
  g.fillCircle(16, 8, 5);

  // Бейсболка / защитная каска
  g.fillStyle(0x0284c7);
  g.fillRect(11, 3, 10, 4);
  g.fillRect(13, 2, 9, 3); // козырек
  g.fillStyle(0x38bdf8);
  g.fillRect(18, 5, 5, 2);

  g.generateTexture(key, W, H);
}

/** Декорации: парковочные конусы, фонарь, дерево */
function _generateDecorations(g) {
  // 1. Конус безопасности
  g.clear();
  g.fillStyle(0xf97316);
  g.fillTriangle(12, 2, 4, 20, 20, 20);
  g.fillStyle(0xffffff);
  g.fillRect(7, 10, 10, 3);
  g.fillRect(6, 15, 12, 3);
  g.fillStyle(0x1e293b);
  g.fillRect(2, 20, 20, 3);
  g.generateTexture('cone', 24, 24);

  // 2. Дерево в кадке (растение для озеленения)
  g.clear();
  g.fillStyle(0x0f172a, 0.4);
  g.fillEllipse(16, 28, 22, 8);
  g.fillStyle(0x475569);
  g.fillRoundedRect(8, 18, 16, 12, 2); // кадка
  g.fillStyle(0x15803d);
  g.fillCircle(16, 11, 11);
  g.fillStyle(0x22c55e);
  g.fillCircle(14, 9, 8);
  g.generateTexture('potted_tree', 32, 32);

  // 3. Фонарный столб со световым пятном
  g.clear();
  g.fillStyle(0x334155);
  g.fillRect(10, 4, 4, 46);
  g.fillRect(6, 4, 12, 4);
  g.fillStyle(0xfef08a);
  g.fillCircle(12, 8, 4);
  g.generateTexture('lamp_post', 24, 52);
}

export default generateAssets;
