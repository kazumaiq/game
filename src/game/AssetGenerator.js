/**
 * AssetGenerator — высококачественная процедурная графика в стиле Premium 2.5D Stylized Tycoon.
 * 
 * Включает:
 * - 4 детализированных класса авто (compact, sedan, suv, premium) x 4 состояния (dirty, foam, rinse, clean)
 * - Детализированное остекление, отражения, диски, тормозные суппорты, контактные тени
 * - Моечные боксы с промышленным оборудованием Kärcher, шлангами, дозаторами и LED-табло
 * - Современное здание автомойки с панорамным остеклением, интерьером и неоновой вывеской
 * - Персонаж оператора в униформе с отражателями, перчатками и пистолетом высокого давления
 * - Парковочная разметка, дренажные решетки, мокрый асфальт, фонари, кустарники
 */

export function generateAssets(scene) {
  const g = scene.make.graphics({ add: false });

  // 1. Асфальтовое покрытие автомойки (глубокий текстурированный графит)
  _generateAsphalt(g);

  // 2. Дорожное полотно с разделительной полосой и бордюром
  _generateRoad(g);

  // 3. Газонная трава (аккуратный ландшафтный газон)
  _generateLawn(g);

  // 4. Дренажная решётка для пола
  _generateDrainage(g);

  // 5. Главное здание администрации автомойки
  _generateBuilding(g);

  // 6. Моечные боксы (нормальный и поврежденный)
  _generateWashBay(g, 'wash_bay_normal', false);
  _generateWashBay(g, 'wash_bay_broken', true);

  // 7. Персонаж оператора в детальной униформе с анимациями
  _generateCharacter(g, 'player_idle', 0);
  _generateCharacter(g, 'player_walk_1', 1);
  _generateCharacter(g, 'player_walk_2', 2);
  _generateCharacter(g, 'player_work', 3);
  _generateCharacter(g, 'player_repair', 4);

  // 7b. Сотрудники (мойщики и техники в ярких оранжево-желтых спецовках)
  _generateEmployee(g, 'employee_idle', 0);
  _generateEmployee(g, 'employee_walk_1', 1);
  _generateEmployee(g, 'employee_walk_2', 2);
  _generateEmployee(g, 'employee_work', 3);
  _generateEmployee(g, 'employee_repair', 4);

  // 8. Автомобили: 6 классов x 4 состояния (dirty, foam, rinse, clean)
  const carTypes = [
    {
      id: 'compact',
      w: 106,
      h: 52,
      baseColor: 0x2563eb,
      roofColor: 0x1d4ed8,
      accentColor: 0x60a5fa,
      wheelR: 8,
      wheelbase: 62,
      bodyType: 'hatchback',
    },
    {
      id: 'sedan',
      w: 120,
      h: 56,
      baseColor: 0x059669,
      roofColor: 0x047857,
      accentColor: 0x34d399,
      wheelR: 9,
      wheelbase: 72,
      bodyType: 'sedan',
    },
    {
      id: 'suv',
      w: 128,
      h: 64,
      baseColor: 0x7c3aed,
      roofColor: 0x6d28d9,
      accentColor: 0xa78bfa,
      wheelR: 11,
      wheelbase: 76,
      bodyType: 'suv',
    },
    {
      id: 'premium',
      w: 134,
      h: 58,
      baseColor: 0xd97706,
      roofColor: 0xb45309,
      accentColor: 0xfbbf24,
      wheelR: 9,
      wheelbase: 82,
      bodyType: 'coupe',
    },
    {
      id: 'wagon',
      w: 126,
      h: 56,
      baseColor: 0x0284c7,
      roofColor: 0x0369a1,
      accentColor: 0x38bdf8,
      wheelR: 9,
      wheelbase: 74,
      bodyType: 'wagon',
    },
    {
      id: 'van',
      w: 136,
      h: 66,
      baseColor: 0xd946ef,
      roofColor: 0xc026d3,
      accentColor: 0xf0abfc,
      wheelR: 10,
      wheelbase: 80,
      bodyType: 'van',
    },
  ];

  for (const car of carTypes) {
    _generateCar(g, `car_${car.id}`, car, 'clean');
    _generateCar(g, `car_${car.id}_dirty`, car, 'dirty');
    _generateCar(g, `car_${car.id}_foam`, car, 'foam');
    _generateCar(g, `car_${car.id}_rinse`, car, 'rinse');
  }

  // 9. Частицы воды, пены и брызг
  _generateParticles(g);

  // 10. Декорации и указатели
  _generateDecorations(g);

  g.destroy();
}

/** 1. Текстурированный графитовый асфальт с микро-зерном и влажным блеском */
function _generateAsphalt(g) {
  g.clear();
  const S = 128;
  // Базовый цвет асфальта
  g.fillStyle(0x161922);
  g.fillRect(0, 0, S, S);

  // Микро-зернистость асфальтовой крошки
  for (let i = 0; i < 90; i++) {
    const rx = (i * 29 + 7) % S;
    const ry = (i * 47 + 13) % S;
    const isLight = i % 3 === 0;
    g.fillStyle(isLight ? 0x242834 : 0x10131a, 0.65);
    g.fillRect(rx, ry, (i % 2) + 1, (i % 2) + 1);
  }

  // Тонкие битумные швы
  g.fillStyle(0x11141c, 0.4);
  g.fillRect(0, 64, S, 1);
  g.fillRect(64, 0, 1, S);

  g.generateTexture('asphalt_ground', S, S);
}

/** 2. Дорожное полотно с бордюром и разметкой */
function _generateRoad(g) {
  g.clear();
  const W = 128;
  const H = 80;

  // Асфальт дороги
  g.fillStyle(0x12151d);
  g.fillRect(0, 0, W, H);

  // Бордюрный камень сверху
  g.fillStyle(0x334155);
  g.fillRect(0, 0, W, 4);
  g.fillStyle(0x1e293b);
  g.fillRect(0, 4, W, 2);

  // Двойная прерывистая разметка
  g.fillStyle(0xf8fafc, 0.95);
  g.fillRect(16, 38, 36, 4);
  g.fillRect(80, 38, 36, 4);

  // Желтая краевая линия
  g.fillStyle(0xf59e0b, 0.85);
  g.fillRect(0, 74, W, 3);

  g.generateTexture('road_strip', W, H);
}

/** 3. Натуральный подстриженный газон */
function _generateLawn(g) {
  g.clear();
  const S = 64;
  g.fillStyle(0x143823);
  g.fillRect(0, 0, S, S);

  // Текстура травы
  for (let i = 0; i < 40; i++) {
    const x = (i * 17) % (S - 4);
    const y = (i * 23) % (S - 4);
    g.fillStyle(i % 2 === 0 ? 0x1b4d31 : 0x0f2d1c, 0.7);
    g.fillRect(x, y, 3, 3);
  }

  g.generateTexture('lawn_tile', S, S);
}

/** 4. Стальная промышленная дренажная решётка */
function _generateDrainage(g) {
  g.clear();
  const W = 64;
  const H = 32;
  g.fillStyle(0x0a0c10);
  g.fillRect(0, 0, W, H);

  // Рамка
  g.fillStyle(0x334155);
  g.fillRect(0, 0, W, 2);
  g.fillRect(0, H - 2, W, 2);
  g.fillRect(0, 0, 2, H);
  g.fillRect(W - 2, 0, 2, H);

  // Стальные щели
  g.fillStyle(0x475569);
  for (let x = 4; x < W - 4; x += 6) {
    g.fillRect(x, 2, 3, H - 4);
  }

  g.generateTexture('drainage_grate', W, H);
}

/** 5. Главное здание администрации автомойки (премиальный современный дизайн) */
function _generateBuilding(g) {
  g.clear();
  const W = 340;
  const H = 185;

  // Мягкая контактная тень от здания
  g.fillStyle(0x06090e, 0.6);
  g.fillRoundedRect(4, 16, W - 8, H - 14, 12);

  // Фасад: темные композитные алюминиевые панели
  g.fillStyle(0x0f172a);
  g.fillRoundedRect(10, 24, W - 20, H - 26, 8);

  // Архитектурная вставка: реечный деревянный фасад
  g.fillStyle(0x78350f, 0.9);
  g.fillRect(20, 48, 55, 96);
  g.fillStyle(0x451a03);
  for (let y = 52; y < 144; y += 6) {
    g.fillRect(20, y, 55, 2);
  }

  // Панорамный стеклянный фасад зоны ожидания клиентов
  const winX = 85;
  const winY = 48;
  const winW = 155;
  const winH = 96;

  // Интерьер: теплый уютный свет клиентской зоны
  g.fillStyle(0x1e293b);
  g.fillRect(winX, winY, winW, winH);
  g.fillStyle(0xfef08a, 0.45);
  g.fillRect(winX, winY, winW, winH);

  // Силуэты внутри: барная стойка, кофемашина, кресла
  g.fillStyle(0x0f172a, 0.7);
  g.fillRect(winX + 15, winY + 54, 45, 30); // стойка
  g.fillStyle(0x38bdf8, 0.8);
  g.fillRect(winX + 25, winY + 44, 12, 10); // монитор
  g.fillStyle(0x334155, 0.8);
  g.fillRoundedRect(winX + 90, winY + 52, 35, 32, 6); // диван

  // Переплет стеклопакетов
  g.lineStyle(2, 0x0f172a, 0.95);
  g.strokeRect(winX, winY, winW, winH);
  g.strokeLineShape(new Phaser.Geom.Line(winX + 52, winY, winX + 52, winY + winH));
  g.strokeLineShape(new Phaser.Geom.Line(winX + 104, winY, winX + 104, winY + winH));
  g.strokeLineShape(new Phaser.Geom.Line(winX, winY + 48, winX + winW, winY + 48));

  // Световые блики на стекле
  g.fillStyle(0xffffff, 0.22);
  g.fillTriangle(winX + 10, winY + winH - 2, winX + 70, winY + 2, winX + 95, winY + 2);
  g.fillTriangle(winX + 60, winY + winH - 2, winX + 120, winY + 2, winX + 140, winY + 2);

  // Входная группа: автоматические раздвижные стеклянные двери
  const doorX = 250;
  const doorY = 56;
  const doorW = 65;
  const doorH = 88;
  g.fillStyle(0x0284c7);
  g.fillRoundedRect(doorX - 2, doorY - 2, doorW + 4, doorH + 4, 4);
  g.fillStyle(0x0ea5e9, 0.35);
  g.fillRect(doorX + 2, doorY + 2, doorW - 4, doorH - 4);
  g.lineStyle(1.5, 0x38bdf8, 0.8);
  g.strokeLineShape(new Phaser.Geom.Line(doorX + doorW / 2, doorY + 2, doorX + doorW / 2, doorY + doorH - 2));

  // Коврик у входа
  g.fillStyle(0x0369a1);
  g.fillRect(doorX + 6, doorY + doorH - 4, doorW - 12, 10);

  // Крыша с козырьком и вентиляционными блоками
  g.fillStyle(0x1e293b);
  g.fillRect(6, 16, W - 12, 18);
  g.fillStyle(0x334155);
  g.fillRect(8, 12, W - 16, 6);

  // Вентиляционный блок (HVAC) на крыше
  g.fillStyle(0x475569);
  g.fillRoundedRect(35, 4, 34, 12, 2);
  g.fillStyle(0x0f172a);
  g.fillCircle(45, 10, 4);
  g.fillCircle(59, 10, 4);

  // Неоновый световой кант крыши (бирюзовый LED)
  g.fillStyle(0x00d2d3);
  g.fillRect(8, 18, W - 16, 3);
  g.fillStyle(0x00d2d3, 0.2);
  g.fillRect(8, 15, W - 16, 9);

  // Главная светящаяся вывеска здания: «АВТОМОЙКА 24/7»
  const signX = 65;
  const signY = 22;
  const signW = 210;
  const signH = 22;

  g.fillStyle(0x090d16, 0.96);
  g.fillRoundedRect(signX, signY, signW, signH, 5);
  g.lineStyle(1.5, 0x00d2d3, 0.9);
  g.strokeRoundedRect(signX, signY, signW, signH, 5);

  // Неоновые буквы (стилизованные плашки с надписью)
  g.fillStyle(0x38bdf8);
  g.fillRect(signX + 16, signY + 6, 8, 10);
  g.fillStyle(0xffffff);
  g.fillRect(signX + 30, signY + 7, 120, 8);
  g.fillStyle(0x22c55e);
  g.fillRect(signX + 160, signY + 6, 34, 10);

  // Настенные светильники по бокам
  g.fillStyle(0xfef08a, 0.9);
  g.fillCircle(18, 54, 3);
  g.fillCircle(322, 54, 3);

  g.generateTexture('building_complex', W, H);
}

/** 6. Профессиональный моечный бокс со стальным навесом и оборудованием */
function _generateWashBay(g, key, broken = false) {
  g.clear();
  const W = 196;
  const H = 146;

  // 1. Контактная тень от бокса
  g.fillStyle(0x06090e, 0.5);
  g.fillRoundedRect(2, 6, W - 4, H - 4, 10);

  // 2. Бетонное основание бокса с водоотталкивающим покрытием
  g.fillStyle(0x181c26);
  g.fillRoundedRect(6, 6, W - 12, H - 12, 8);

  // 3. Сигнальная диагональная разметка въезда (желто-черная безопасность)
  const stripeW = 16;
  for (let i = 0; i < 9; i++) {
    g.fillStyle(i % 2 === 0 ? 0xf59e0b : 0x0f172a);
    g.fillRect(16 + i * stripeW, H - 12, stripeW, 6);
  }

  // 4. Центральный приямок с дренажной решёткой для стока воды
  const grateX = 42;
  const grateY = 48;
  const grateW = W - 84;
  const grateH = 48;
  g.fillStyle(0x090b10);
  g.fillRect(grateX, grateY, grateW, grateH);

  g.lineStyle(1.5, 0x475569, 0.85);
  for (let y = grateY + 3; y < grateY + grateH; y += 6) {
    g.strokeLineShape(new Phaser.Geom.Line(grateX + 3, y, grateX + grateW - 3, y));
  }
  g.lineStyle(1.5, 0x334155, 0.9);
  g.strokeLineShape(new Phaser.Geom.Line(grateX + grateW / 2, grateY, grateX + grateW / 2, grateY + grateH));

  // 5. Ограничители колес (направляющие рельсы)
  g.fillStyle(0x0284c7, 0.8);
  g.fillRect(26, 42, 6, 65);
  g.fillRect(W - 32, 42, 6, 65);

  // 6. Несущие стальные колонны навеса
  const postColor = broken ? 0xef4444 : 0x0284c7;
  // Левая опора
  g.fillStyle(0x334155);
  g.fillRect(8, 10, 16, H - 28);
  g.fillStyle(postColor);
  g.fillRect(11, 13, 10, H - 34);
  g.fillStyle(0x475569);
  g.fillRect(6, H - 22, 20, 6); // опорный башмак

  // Правая опора
  g.fillStyle(0x334155);
  g.fillRect(W - 24, 10, 16, H - 28);
  g.fillStyle(postColor);
  g.fillRect(W - 21, 13, 10, H - 34);
  g.fillStyle(0x475569);
  g.fillRect(W - 26, H - 22, 20, 6);

  // 7. Крыша и поперечная ферма бокса
  g.fillStyle(0x1e293b);
  g.fillRect(6, 6, W - 12, 20);
  g.fillStyle(0x0f172a);
  g.fillRect(8, 22, W - 16, 4);

  // LED полоса подсветки козырька
  const neonCol = broken ? 0xef4444 : 0x00d2d3;
  g.fillStyle(neonCol);
  g.fillRect(10, 8, W - 20, 3);
  g.fillStyle(neonCol, 0.25);
  g.fillRect(10, 6, W - 20, 7);

  // 8. Потолочная поворотная консоль Z-образная для подачи воды/пены
  g.lineStyle(3, 0x64748b, 0.9);
  g.beginPath();
  g.moveTo(W / 2, 22);
  g.lineTo(W / 2, 34);
  g.lineTo(W / 2 - 20, 42);
  g.strokePath();
  g.fillStyle(0x38bdf8);
  g.fillCircle(W / 2 - 20, 42, 3);

  // 9. Настенный аппарат высокого давления Kärcher со шлангом и баками
  const stationX = 14;
  const stationY = 32;

  // Корпус аппарата (желто-черный)
  g.fillStyle(0x0f172a);
  g.fillRoundedRect(stationX, stationY, 18, 34, 3);
  g.fillStyle(0xf59e0b);
  g.fillRect(stationX + 2, stationY + 4, 14, 14);

  // Манометр давления
  g.fillStyle(0xffffff);
  g.fillCircle(stationX + 9, stationY + 11, 4);
  g.fillStyle(0xef4444);
  g.fillCircle(stationX + 9, stationY + 11, 1.5);

  // Баки автохимии (синий шампунь и розовая пена)
  g.fillStyle(0x0284c7, 0.8);
  g.fillRect(stationX + 2, stationY + 20, 6, 10);
  g.fillStyle(0xec4899, 0.8);
  g.fillRect(stationX + 10, stationY + 20, 6, 10);

  // Гибкий шланг высокого давления
  g.lineStyle(2, 0x0284c7, 0.95);
  g.beginPath();
  g.moveTo(stationX + 9, stationY + 34);
  g.lineTo(stationX + 16, stationY + 44);
  g.lineTo(stationX + 8, stationY + 54);
  g.lineTo(stationX + 18, stationY + 68);
  g.strokePath();

  // Пистолет-распылитель в настенном креплении
  g.fillStyle(0x334155);
  g.fillRect(stationX + 16, stationY + 66, 4, 12);
  g.fillStyle(0x94a3b8);
  g.fillRect(stationX + 14, stationY + 76, 8, 3);

  // 10. Если бокс сломан: аварийный знак и пар/искры
  if (broken) {
    // Красный мигающий маячок
    g.fillStyle(0xef4444);
    g.fillCircle(W / 2, 14, 6);
    g.fillStyle(0xffffff);
    g.fillCircle(W / 2, 14, 2);

    // Знак аварии
    g.fillStyle(0xef4444);
    g.fillTriangle(W / 2, 28, W / 2 - 14, 50, W / 2 + 14, 50);
    g.fillStyle(0xffffff);
    g.fillRect(W / 2 - 2, 34, 4, 9);
    g.fillRect(W / 2 - 2, 45, 4, 3);

    // Пятно утечки на полу
    g.fillStyle(0x38bdf8, 0.4);
    g.fillEllipse(stationX + 22, stationY + 60, 24, 12);
  } else {
    // Зеленый индикатор готовности
    g.fillStyle(0x22c55e);
    g.fillCircle(W / 2, 14, 4);
    g.fillStyle(0xbbf7d0);
    g.fillCircle(W / 2, 14, 1.5);
  }

  g.generateTexture(key, W, H);
}

/** 7. Персонаж оператора в профессиональной униформе с деталями */
function _generateCharacter(g, key, frame = 0) {
  g.clear();
  const W = 46;
  const H = 60;

  // Контактная тень персонажа
  g.fillStyle(0x06090e, 0.5);
  g.fillEllipse(23, 54, 26, 10);

  let legOff1 = 0;
  let legOff2 = 0;
  let armOff1 = 0;
  let armOff2 = 0;

  if (frame === 1) { // Шаг 1
    legOff1 = -4; legOff2 = 4;
    armOff1 = 3;  armOff2 = -3;
  } else if (frame === 2) { // Шаг 2
    legOff1 = 4;  legOff2 = -4;
    armOff1 = -3; armOff2 = 3;
  }

  // Ноги в прочных влагозащитных брюках
  g.fillStyle(0x1e293b);
  g.fillRect(14, 34 + legOff1, 7, 15);
  g.fillRect(25, 34 + legOff2, 7, 15);

  // Нескользящие рабочие сапоги с усиленным носком
  g.fillStyle(0x0f172a);
  g.fillRoundedRect(12, 47 + legOff1, 10, 7, 2);
  g.fillRoundedRect(24, 47 + legOff2, 10, 7, 2);
  g.fillStyle(0x475569);
  g.fillRect(12, 52 + legOff1, 10, 2);
  g.fillRect(24, 52 + legOff2, 10, 2);

  // Туловище: куртка униформы (насыщенный синий цвет)
  g.fillStyle(0x0369a1);
  g.fillRoundedRect(11, 18, 24, 20, 5);

  // Светоотражающие полосы безопасности 3M (лайм + серебро)
  g.fillStyle(0xa3e635);
  g.fillRect(13, 23, 20, 4);
  g.fillRect(13, 31, 20, 3);
  g.fillStyle(0xf8fafc, 0.85);
  g.fillRect(13, 24, 20, 1.5);

  // Руки и рабочие синие нитриловые перчатки
  g.fillStyle(0x0284c7);
  if (frame === 3) {
    // Поза мойки: руки держат пистолет-распылитель
    g.fillRect(27, 20, 12, 6);
    g.fillStyle(0x38bdf8); // перчатка
    g.fillCircle(38, 23, 4);

    // Моечный пистолет с удлиненным стальным копьем
    g.fillStyle(0x0f172a);
    g.fillRect(36, 18, 5, 14); // рукоятка
    g.fillStyle(0x94a3b8);
    g.fillRect(39, 17, 18, 3);  // ствол
    g.fillStyle(0xf59e0b);
    g.fillRect(57, 16, 4, 5);  // латунная форсунка

    // Шланг, уходящий назад
    g.lineStyle(2, 0x0f172a, 0.9);
    g.beginPath();
    g.moveTo(37, 32);
    g.lineTo(31, 38);
    g.lineTo(24, 44);
    g.strokePath();
  } else if (frame === 4) {
    // Поза ремонта: гаечный ключ в руках
    g.fillRect(25, 22, 10, 6);
    g.fillStyle(0x38bdf8);
    g.fillCircle(35, 25, 4);
    g.fillStyle(0x94a3b8);
    g.fillRect(33, 22, 14, 4);
    g.fillRect(45, 19, 4, 10);
  } else {
    // Обычная ходьба / покой
    g.fillRect(7, 20 + armOff1, 6, 14);
    g.fillRect(33, 20 + armOff2, 6, 14);
    g.fillStyle(0x38bdf8); // синие перчатки
    g.fillCircle(10, 34 + armOff1, 3.5);
    g.fillCircle(36, 34 + armOff2, 3.5);
  }

  // Голова
  g.fillStyle(0xfbcfe8);
  g.fillCircle(23, 12, 7.5);

  // Фирменная кепка с козырьком
  g.fillStyle(0x00d2d3);
  g.fillRoundedRect(15, 5, 16, 7, 3);
  g.fillRect(18, 3, 13, 4);
  // Козырек
  g.fillStyle(0x0891b2);
  g.fillRect(23, 9, 10, 3);

  // Защитные очки на лбу
  g.fillStyle(0x0f172a);
  g.fillRect(17, 7, 12, 2.5);
  g.fillStyle(0x38bdf8, 0.9);
  g.fillRect(19, 7, 4, 2);
  g.fillRect(24, 7, 4, 2);

  g.generateTexture(key, W, H);
}

/** 8. Создание высокодетализированного автомобиля в 2.5D ракурсе */
function _generateCar(g, key, conf, state) {
  g.clear();
  const W = conf.w;
  const H = conf.h;

  // 1. Многослойная мягкая контактная тень (Ambient Occlusion)
  g.fillStyle(0x05080e, 0.35);
  g.fillEllipse(W / 2 + 2, H / 2 + 6, W * 0.96, H * 0.88);
  g.fillStyle(0x05080e, 0.65);
  g.fillEllipse(W / 2 + 1, H / 2 + 7, W * 0.82, H * 0.72);

  // 2. Колеса: резиновые шины с протектором, литые диски и тормозные диски
  const wheelW = conf.wheelR * 2 + 2;
  const wheelH = Math.round(conf.h * 0.22);
  const frontWheelX = W - Math.round(W * 0.22);
  const rearWheelX = Math.round(W * 0.18);
  const topWheelY = 3;
  const botWheelY = H - wheelH - 3;

  const wheelPositions = [
    { x: rearWheelX, y: topWheelY },
    { x: frontWheelX, y: topWheelY },
    { x: rearWheelX, y: botWheelY },
    { x: frontWheelX, y: botWheelY },
  ];

  for (const wp of wheelPositions) {
    // Шина (темно-серый резиновый компаунд)
    g.fillStyle(0x0f141c);
    g.fillRoundedRect(wp.x - wheelW / 2, wp.y, wheelW, wheelH, 4);
    // Протектор
    g.fillStyle(0x1e293b);
    g.fillRect(wp.x - wheelW / 2 + 2, wp.y + 1, wheelW - 4, 1.5);
    g.fillRect(wp.x - wheelW / 2 + 2, wp.y + wheelH - 2.5, wheelW - 4, 1.5);

    // Тормозной суппорт (спортивный красный / золотой)
    g.fillStyle(0xef4444);
    g.fillRect(wp.x - 2, wp.y + 3, 4, wheelH - 6);

    // Литой легкосплавный диск с лучами
    g.fillStyle(0x94a3b8);
    g.fillRoundedRect(wp.x - wheelW / 2 + 3, wp.y + 2, wheelW - 6, wheelH - 4, 2);
    g.fillStyle(0x0f172a);
    g.fillCircle(wp.x, wp.y + wheelH / 2, 2.5); // ступица
  }

  // 3. Цвет кузова с учетом состояния (грязь приглушает базовый цвет)
  let baseColor = conf.baseColor;
  let roofColor = conf.roofColor;

  if (state === 'dirty') {
    // Приглушенный запыленный оттенок
    const r = Math.round(((baseColor >> 16) & 0xff) * 0.65);
    const gr = Math.round(((baseColor >> 8) & 0xff) * 0.65);
    const b = Math.round((baseColor & 0xff) * 0.65);
    baseColor = (r << 16) | (gr << 8) | b;
  }

  // 4. Нижний контур кузова (пороги, бамперы, колесные арки)
  g.fillStyle(0x0f172a);
  g.fillRoundedRect(6, 6, W - 12, H - 12, 10);

  // 5. Основная панель кузова с объемом
  g.fillStyle(baseColor);
  g.fillRoundedRect(7, 7, W - 14, H - 14, 9);

  // Верхний световой скос (ambient highlight от верхнего света)
  g.fillStyle(0xffffff, state === 'clean' ? 0.35 : 0.15);
  g.fillRoundedRect(8, 8, W - 16, Math.round(H * 0.3), 6);
  g.fillStyle(baseColor);
  g.fillRoundedRect(8, 12, W - 16, H - 24, 7);

  // 6. Передний и задний бамперы, решетка радиатора
  // Решетка радиатора спереди (справа)
  g.fillStyle(0x0a0d14);
  g.fillRoundedRect(W - 10, Math.round(H * 0.28), 5, Math.round(H * 0.44), 2);
  g.fillStyle(0x334155);
  for (let y = Math.round(H * 0.32); y < Math.round(H * 0.68); y += 4) {
    g.fillRect(W - 10, y, 4, 1.5);
  }

  // Передние фары (современные LED линзы с ксеноновым свечением)
  g.fillStyle(0xe0f2fe);
  g.fillRoundedRect(W - 11, 10, 6, 9, 2);
  g.fillRoundedRect(W - 11, H - 19, 6, 9, 2);
  g.fillStyle(0x38bdf8, 0.9);
  g.fillRect(W - 9, 12, 2.5, 5);
  g.fillRect(W - 9, H - 17, 2.5, 5);

  // Задние фонари (светодиодные полосы красного цвета)
  g.fillStyle(0xdc2626);
  g.fillRoundedRect(6, 11, 4, 8, 1.5);
  g.fillRoundedRect(6, H - 19, 4, 8, 1.5);
  g.fillStyle(0xf87171);
  g.fillRect(7, 13, 2, 4);
  g.fillRect(7, H - 17, 2, 4);

  // Боковые зеркала заднего вида
  const mirrorX = Math.round(W * 0.68);
  g.fillStyle(baseColor);
  g.fillRoundedRect(mirrorX, 2, 8, 5, 2);
  g.fillRoundedRect(mirrorX, H - 7, 8, 5, 2);
  g.fillStyle(0x38bdf8, 0.7);
  g.fillRect(mirrorX + 1, 3, 5, 2);
  g.fillRect(mirrorX + 1, H - 5, 5, 2);

  // 7. Остекление кабины (глубокий синий сапфир с интерьером)
  const cabX = Math.round(W * 0.24);
  const cabY = Math.round(H * 0.17);
  const cabW = Math.round(W * 0.52);
  const cabH = Math.round(H * 0.66);

  g.fillStyle(0x081326);
  g.fillRoundedRect(cabX, cabY, cabW, cabH, 6);

  // Внутренний интерьер (руль и подголовники)
  g.fillStyle(0x1e293b, 0.75);
  g.fillCircle(cabX + cabW * 0.7, cabY + cabH * 0.35, 4); // руль
  g.fillRoundedRect(cabX + cabW * 0.38, cabY + cabH * 0.25, 7, 9, 2); // кресло 1
  g.fillRoundedRect(cabX + cabW * 0.38, cabY + cabH * 0.55, 7, 9, 2); // кресло 2

  // Крыша автомобиля
  const roofX = cabX + Math.round(cabW * 0.16);
  const roofY = cabY + Math.round(cabH * 0.14);
  const roofW = Math.round(cabW * 0.68);
  const roofH = Math.round(cabH * 0.72);

  g.fillStyle(roofColor);
  g.fillRoundedRect(roofX, roofY, roofW, roofH, 4);

  // Релинги для SUV, универсала, фургона или панорамный люк для Premium
  if (conf.bodyType === 'suv' || conf.bodyType === 'wagon') {
    g.fillStyle(0x94a3b8);
    g.fillRect(roofX + 2, roofY - 1, roofW - 4, 2);
    g.fillRect(roofX + 2, roofY + roofH - 1, roofW - 4, 2);
  } else if (conf.bodyType === 'van') {
    // Рёбра жёсткости на крыше коммерческого фургона
    g.fillStyle(0x334155);
    for (let x = roofX + 6; x < roofX + roofW - 6; x += 10) {
      g.fillRect(x, roofY + 2, 2, roofH - 4);
    }
  } else if (conf.bodyType === 'coupe' || conf.id === 'premium') {
    g.fillStyle(0x0f172a, 0.85);
    g.fillRoundedRect(roofX + 8, roofY + 4, roofW - 16, roofH - 8, 2);
  }

  // Стекла: лобовое, заднее и боковые
  // Лобовое стекло (справа)
  g.fillStyle(0x1e3a5f, 0.85);
  g.fillRect(cabX + cabW - 8, cabY + 4, 6, cabH - 8);
  // Заднее стекло (слева)
  g.fillRect(cabX + 2, cabY + 4, 6, cabH - 8);

  // 8. Состояние: ЧИСТАЯ (глянцевые блики, полировка, блеск)
  if (state === 'clean') {
    // Диагональные световые полосы на лобовом стекле
    g.fillStyle(0xffffff, 0.45);
    g.fillTriangle(cabX + cabW - 3, cabY + 4, cabX + cabW - 9, cabY + cabH - 4, cabX + cabW - 6, cabY + cabH - 4);
    g.fillTriangle(cabX + cabW - 1, cabY + 4, cabX + cabW - 4, cabY + cabH - 4, cabX + cabW - 2, cabY + cabH - 4);

    // Глянцевая линия блика по плечевой линии кузова
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(16, 9, W - 32, 2);

    // Звездный блик на капоте
    const glintX = W - 26;
    const glintY = 16;
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(glintX - 4, glintY, 9, 1.5);
    g.fillRect(glintX, glintY - 4, 1.5, 9);
    g.fillCircle(glintX, glintY, 2);
  }

  // 9. Состояние: ГРЯЗНАЯ (реалистичная дорожная пыль, брызги глины, следы дворников)
  if (state === 'dirty') {
    // Матовый грязевой налет снизу и сзади
    g.fillStyle(0x3f2212, 0.8);
    // Брызги на колесных арках
    g.fillCircle(rearWheelX - 4, topWheelY + 8, 6);
    g.fillCircle(frontWheelX - 4, topWheelY + 8, 5);
    g.fillCircle(rearWheelX - 4, botWheelY - 2, 7);
    g.fillCircle(frontWheelX - 4, botWheelY - 2, 6);

    // Пятна дорожной грязи на дверях и бампере
    g.fillStyle(0x593118, 0.75);
    g.fillRoundedRect(10, H - 18, Math.round(W * 0.4), 8, 3);
    g.fillRoundedRect(W - 36, H - 18, 24, 7, 3);
    g.fillCircle(W * 0.35, H * 0.7, 5);
    g.fillCircle(W * 0.55, H * 0.3, 4.5);
    g.fillCircle(W * 0.75, H * 0.65, 5);

    // Запыленное лобовое стекло со следом от дворника!
    g.fillStyle(0x78350f, 0.5);
    g.fillRect(cabX + cabW - 8, cabY + 4, 6, cabH - 8);
    // Чистая дуга от стеклоочистителя
    g.fillStyle(0x1e3a5f, 0.9);
    g.fillEllipse(cabX + cabW - 5, cabY + cabH / 2, 4, cabH * 0.55);
  }

  // 10. Состояние: ПЕНА (объемные шапки пены Kärcher, потеки, пузыри)
  if (state === 'foam') {
    // Базовый слой снежно-белой пены
    g.fillStyle(0xffffff, 0.92);
    // Пена на крыше
    g.fillRoundedRect(roofX - 2, roofY - 2, roofW + 4, roofH + 4, 6);

    // Капли и шапки пены разного радиуса по всему кузову
    const seed = conf.w * 3;
    for (let i = 0; i < 38; i++) {
      const bx = 12 + ((i * 31 + seed) % (W - 24));
      const by = 8 + ((i * 43 + seed) % (H - 16));
      const rad = 3.5 + (i % 6);
      g.fillStyle(i % 3 === 0 ? 0xf0fdf4 : 0xffffff, 0.95);
      g.fillCircle(bx, by, rad);
    }

    // Стекающие потеки пены по порогам
    g.fillStyle(0xffffff, 0.9);
    for (let x = 20; x < W - 20; x += 14) {
      g.fillRoundedRect(x, H - 11, 8, 5, 2);
    }
  }

  // 11. Состояние: СМЫВАНИЕ (потоки воды, стекающая пена, мокрый лак)
  if (state === 'rinse') {
    // Частично смытая пена на задней части
    g.fillStyle(0xffffff, 0.7);
    for (let i = 0; i < 18; i++) {
      const bx = 12 + ((i * 19) % Math.round(W * 0.5));
      const by = 10 + ((i * 29) % (H - 20));
      g.fillCircle(bx, by, 3 + (i % 4));
    }

    // Водяные струи и потоки смыва (бирюзово-голубые линии)
    g.lineStyle(2, 0x38bdf8, 0.85);
    for (let y = 14; y < H - 14; y += 8) {
      g.strokeLineShape(new Phaser.Geom.Line(Math.round(W * 0.35), y, W - 14, y - 2));
    }

    // Мокрый блеск на чистом капоте
    g.fillStyle(0xbae6fd, 0.6);
    g.fillRect(W - 32, 14, 18, H - 28);
  }

  g.generateTexture(key, W, H);
}

/** 9. Частицы брызг, пены и воды */
function _generateParticles(g) {
  // Капля воды
  g.clear();
  g.fillStyle(0x38bdf8, 0.9);
  g.fillCircle(4, 4, 3);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(3, 3, 1);
  g.generateTexture('particle_water', 8, 8);

  // Пузырек пены
  g.clear();
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(5, 5, 4);
  g.fillStyle(0x38bdf8, 0.4);
  g.fillCircle(6, 6, 2);
  g.generateTexture('particle_foam', 10, 10);

  // Водяная пыль/пар
  g.clear();
  g.fillStyle(0xbae6fd, 0.35);
  g.fillCircle(8, 8, 6);
  g.generateTexture('particle_mist', 16, 16);
}

/** 10. Декорации, фонари, деревья и дорожные указатели */
function _generateDecorations(g) {
  // Ограждающий конус со световозвращающей полосой
  g.clear();
  g.fillStyle(0x0a0c10, 0.4);
  g.fillEllipse(15, 30, 22, 6); // тень
  g.fillStyle(0x1e293b);
  g.fillRect(3, 26, 24, 4); // резиновая база
  g.fillStyle(0xf97316);
  g.fillTriangle(15, 2, 5, 26, 25, 26); // оранжевый конус
  g.fillStyle(0xffffff, 0.95);
  g.fillRect(10, 13, 10, 5); // белая световозвращающая полоса
  g.generateTexture('cone', 30, 34);

  // Дерево в современной бетонной кадке
  g.clear();
  const TW = 44;
  const TH = 52;
  // Тень
  g.fillStyle(0x06090e, 0.4);
  g.fillEllipse(TW / 2, TH - 4, 32, 10);
  // Бетонная прямоугольная кадка
  g.fillStyle(0x475569);
  g.fillRoundedRect(8, TH - 22, TW - 16, 18, 4);
  g.fillStyle(0x334155);
  g.fillRect(10, TH - 20, TW - 20, 2);
  // Ствол
  g.fillStyle(0x78350f);
  g.fillRect(TW / 2 - 2, TH - 30, 4, 12);
  // Пышная стилизованная крона (многоуровневые круги)
  g.fillStyle(0x14532d);
  g.fillCircle(TW / 2, 20, 16);
  g.fillStyle(0x16a34a);
  g.fillCircle(TW / 2 - 4, 17, 12);
  g.fillStyle(0x4ade80, 0.75);
  g.fillCircle(TW / 2 + 3, 13, 8);
  g.generateTexture('potted_tree', TW, TH);

  // Современный уличный фонарный столб с направленным светом
  g.clear();
  const LW = 36;
  const LH = 74;
  // Стойка столба
  g.fillStyle(0x334155);
  g.fillRect(16, 8, 4, LH - 10);
  g.fillStyle(0x1e293b);
  g.fillRect(13, LH - 6, 10, 6);
  // Консоль со светильником
  g.fillStyle(0x475569);
  g.fillRect(8, 6, 20, 5);
  // Плафон с теплым LED-светом
  g.fillStyle(0xfef08a);
  g.fillCircle(18, 12, 5);
  g.fillStyle(0xfef08a, 0.35);
  g.fillCircle(18, 12, 12);
  g.generateTexture('lamp_post', LW, LH);
}

/** 11. Сотрудник автомойки (профессиональная форма, отличная от игрока) */
function _generateEmployee(g, key, frame = 0) {
  g.clear();
  const W = 46;
  const H = 60;

  // Контактная тень сотрудника
  g.fillStyle(0x06090e, 0.5);
  g.fillEllipse(23, 54, 26, 10);

  let legOff1 = 0;
  let legOff2 = 0;
  let armOff1 = 0;
  let armOff2 = 0;

  if (frame === 1) {
    legOff1 = -4; legOff2 = 4;
    armOff1 = 3;  armOff2 = -3;
  } else if (frame === 2) {
    legOff1 = 4;  legOff2 = -4;
    armOff1 = -3; armOff2 = 3;
  }

  // Брюки спецодежды (темно-серый графит)
  g.fillStyle(0x334155);
  g.fillRect(14, 34 + legOff1, 7, 15);
  g.fillRect(25, 34 + legOff2, 7, 15);

  // Нескользящие сапоги с усиленным мыском
  g.fillStyle(0x0f172a);
  g.fillRoundedRect(12, 47 + legOff1, 10, 7, 2);
  g.fillRoundedRect(24, 47 + legOff2, 10, 7, 2);
  g.fillStyle(0xf59e0b);
  g.fillRect(12, 52 + legOff1, 10, 2);
  g.fillRect(24, 52 + legOff2, 10, 2);

  // Куртка униформы (яркий оранжево-желтый цвет безопасности)
  g.fillStyle(0xf59e0b);
  g.fillRoundedRect(11, 18, 24, 20, 5);

  // Контрастные темные вставки на плечах и боках
  g.fillStyle(0x1e293b);
  g.fillRect(11, 18, 5, 20);
  g.fillRect(30, 18, 5, 20);

  // Светоотражающие полосы (серебристо-белые)
  g.fillStyle(0xf8fafc, 0.9);
  g.fillRect(11, 25, 24, 3);
  g.fillRect(11, 32, 24, 2.5);

  // Руки и рабочие перчатки
  g.fillStyle(0xd97706);
  if (frame === 3) {
    // Поза мойки: руки с моечным пистолетом
    g.fillRect(27, 20, 12, 6);
    g.fillStyle(0x0f172a); // черная перчатка
    g.fillCircle(38, 23, 4);

    // Моечный пистолет
    g.fillStyle(0x1e293b);
    g.fillRect(36, 18, 5, 14);
    g.fillStyle(0x94a3b8);
    g.fillRect(39, 17, 18, 3);
    g.fillStyle(0x38bdf8);
    g.fillRect(57, 16, 4, 5);

    // Шланг
    g.lineStyle(2, 0x0284c7, 0.9);
    g.beginPath();
    g.moveTo(37, 32);
    g.lineTo(31, 38);
    g.lineTo(24, 44);
    g.strokePath();
  } else if (frame === 4) {
    // Поза ремонта: руки с гаечным ключом
    g.fillRect(25, 22, 10, 6);
    g.fillStyle(0x0f172a);
    g.fillCircle(35, 25, 4);
    g.fillStyle(0x94a3b8);
    g.fillRect(33, 22, 14, 4);
    g.fillRect(45, 19, 4, 10);
  } else {
    // Ходьба / покой
    g.fillRect(7, 20 + armOff1, 6, 14);
    g.fillRect(33, 20 + armOff2, 6, 14);
    g.fillStyle(0x0f172a);
    g.fillCircle(10, 34 + armOff1, 3.5);
    g.fillCircle(36, 34 + armOff2, 3.5);
  }

  // Голова
  g.fillStyle(0xfcd34d);
  g.fillCircle(23, 12, 7.5);

  // Рабочая каска безопасности (желто-оранжевая, без кепки)
  g.fillStyle(0xeab308);
  g.fillRoundedRect(14, 5, 18, 8, 4);
  g.fillRect(13, 10, 20, 3);

  // Защитные очки на каске
  g.fillStyle(0x0f172a);
  g.fillRect(16, 7, 14, 2.5);
  g.fillStyle(0x38bdf8, 0.95);
  g.fillRect(18, 7, 4, 2);
  g.fillRect(24, 7, 4, 2);

  g.generateTexture(key, W, H);
}

export default generateAssets;
