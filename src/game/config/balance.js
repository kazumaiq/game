/**
 * Единая конфигурация игрового баланса.
 * Все цены, ставки, опции оборудования, документы и проверки — в одном месте.
 */

export const BALANCE = {
  // Стартовый капитал
  startingCapital: 6_000_000,

  // Базовые расходы на запуск (по умолчанию при классическом сценарии)
  startupCosts: {
    deposit: 300_000,       // Залог и первый месяц аренды
    permits: 250_000,       // Документы и разрешения
    construction: 2_100_000,// Подготовка территории
    equipment: 1_650_000,   // Комплект б/у оборудования
    utilities: 500_000,     // Подключения и монтаж
    supplies: 200_000,      // Начальные расходные материалы
    signage: 400_000,       // Вывеска и открытие
  },

  get totalStartupCost() {
    return Object.values(this.startupCosts).reduce((s, v) => s + v, 0);
  },

  get startingBalance() {
    return this.startingCapital - this.totalStartupCost;
  },

  // Опции оборудования при старте
  equipmentOptions: {
    used: {
      id: 'used',
      name: 'Комплект б/у оборудования',
      cost: 1_650_000,
      breakChanceMult: 1.0,
      qualityMult: 1.0,
      description: 'Доступный вариант, умеренный шанс поломок.',
    },
    newStandard: {
      id: 'newStandard',
      name: 'Новое оборудование Kärcher',
      cost: 2_400_000,
      breakChanceMult: 0.5,
      qualityMult: 1.25,
      description: 'Высокая надежность и повышенное качество мойки.',
    },
    premiumAuto: {
      id: 'premiumAuto',
      name: 'Премиум-комплекс с дозатором химии',
      cost: 3_200_000,
      breakChanceMult: 0.3,
      qualityMult: 1.5,
      description: 'Максимальная скорость, идеальная пена, редкие поломки.',
    },
  },

  // Документы и разрешительная система
  documents: {
    ses: {
      id: 'ses',
      name: 'Заключение СЭС (санитарный надзор)',
      cost: 60_000,
      fine: 120_000,
      description: 'Требуется для законной работы и безопасной утилизации стоков.',
    },
    fire: {
      id: 'fire',
      name: 'Пожарный аудит и разрешение МЧС',
      cost: 70_000,
      fine: 150_000,
      description: 'Проверка электропроводки, насосов и огнетушителей.',
    },
    ecology: {
      id: 'ecology',
      name: 'Экологический паспорт и очистные',
      cost: 80_000,
      fine: 200_000,
      description: 'Нормативы сброса фильтрованной воды в канализацию.',
    },
    vodokanal: {
      id: 'vodokanal',
      name: 'Договор с Водоканалом и опломбировка',
      cost: 40_000,
      fine: 90_000,
      description: 'Официальный учет расхода и давления воды.',
    },
  },

  // Проверки (инспекции)
  inspections: [
    { day: 3, type: 'ses', name: 'Плановый рейд СЭС' },
    { day: 7, type: 'fire', name: 'Инспекция пожарной безопасности' },
    { day: 12, type: 'ecology', name: 'Экологический контроль стоков' },
  ],

  // Локации
  locations: {
    roadside: {
      id: 'roadside',
      name: 'Придорожная территория',
      monthlyRent: 150_000,
      get dailyRent() { return Math.round(this.monthlyRent / 30); },
      customerFlow: 1.0,
      repeatBonus: 0.0,
      avgCheckMultiplier: 1.0,
      competitionPressure: 0.8,
      description: 'Высокий поток случайных клиентов. Умеренные риски.',
    },
    residential: {
      id: 'residential',
      name: 'Жилой район',
      monthlyRent: 110_000,
      get dailyRent() { return Math.round(this.monthlyRent / 30); },
      customerFlow: 0.7,
      repeatBonus: 0.3,
      avgCheckMultiplier: 0.9,
      competitionPressure: 0.5,
      description: 'Меньше трафика, больше постоянных клиентов.',
    },
    business: {
      id: 'business',
      name: 'Деловой район',
      monthlyRent: 250_000,
      get dailyRent() { return Math.round(this.monthlyRent / 30); },
      customerFlow: 0.85,
      repeatBonus: 0.1,
      avgCheckMultiplier: 1.4,
      competitionPressure: 1.2,
      description: 'Выше средний чек, сильнее конкуренция.',
    },
  },

  // Услуги
  services: {
    expressWash: {
      id: 'expressWash',
      name: 'Экспресс-мойка',
      basePrice: 500,
      priceMultiplier: 1,
      supplyCost: 100,
      minPrice: 100,
      maxPrice: 2000,
      stages: ['foam', 'rinse', 'finish'],
      stageNames: {
        foam: 'Нанесение пены',
        rinse: 'Смывание',
        finish: 'Финишная обработка',
      },
      baseDuration: 3000,
    },
    deepWash: {
      id: 'deepWash',
      name: 'Глубокая мойка',
      basePrice: 850,
      priceMultiplier: 1.7,
      supplyCost: 150,
      stages: ['foam', 'rinse', 'wheels', 'finish'],
      stageNames: {
        foam: 'Активная пена',
        rinse: 'Смывание',
        wheels: 'Очистка колёс',
        finish: 'Финишная обработка',
      },
      baseDuration: 3600,
    },
    premiumDetail: {
      id: 'premiumDetail',
      name: 'Премиум-детейлинг',
      basePrice: 1400,
      priceMultiplier: 2.8,
      supplyCost: 220,
      stages: ['foam', 'rinse', 'finish', 'polish'],
      stageNames: {
        foam: 'Бережная пена',
        rinse: 'Деликатное смывание',
        finish: 'Сушка и защита',
        polish: 'Полировка кузова',
      },
      baseDuration: 4500,
    },
  },

  // Классы автомобилей
  carClasses: {
    compact: {
      id: 'compact',
      name: 'Компактный',
      timeMultiplier: 0.8,
      supplyCostMultiplier: 0.8,
      priceMultiplier: 0.9,
      color: 0x4a90d9,
      width: 32, height: 20,
    },
    sedan: {
      id: 'sedan',
      name: 'Седан',
      timeMultiplier: 1.0,
      supplyCostMultiplier: 1.0,
      priceMultiplier: 1.0,
      color: 0x7ed321,
      width: 38, height: 22,
    },
    suv: {
      id: 'suv',
      name: 'Внедорожник',
      timeMultiplier: 1.3,
      supplyCostMultiplier: 1.3,
      priceMultiplier: 1.2,
      color: 0x9b59b6,
      width: 42, height: 26,
    },
    premium: {
      id: 'premium',
      name: 'Премиум',
      timeMultiplier: 1.5,
      supplyCostMultiplier: 1.0,
      priceMultiplier: 1.8,
      color: 0xf39c12,
      width: 44, height: 24,
    },
    wagon: {
      id: 'wagon',
      name: 'Универсал',
      timeMultiplier: 1.2,
      supplyCostMultiplier: 1.1,
      priceMultiplier: 1.1,
      color: 0x2ecc71,
      width: 40, height: 24,
    },
    van: {
      id: 'van',
      name: 'Фургон',
      timeMultiplier: 1.6,
      supplyCostMultiplier: 1.4,
      priceMultiplier: 1.5,
      color: 0xe74c3c,
      width: 46, height: 28,
    },
  },

  // Клиенты
  customer: {
    basePatience: 30000,
    patienceVariance: 10000,
    spawnIntervalBase: 8000,
    spawnIntervalVariance: 4000,
    maxQueueSize: 6,
    maxActiveCars: 8,
    repeatVisitBase: 0.2,
  },

  // Сотрудники
  employee: {
    hireCost: 0,
    dailySalary: 3000,
    baseSpeed: 0.7,
    baseQuality: 0.75,
    maxEmployees: 4,
  },

  // Ежедневные коммунальные
  dailyCosts: {
    utilities: 1500,
  },

  // Улучшения
  upgrades: {
    washSpeed: {
      id: 'washSpeed',
      name: 'Скорость мойки',
      description: 'Уменьшает время каждого этапа мойки',
      maxLevel: 5,
      prices: [50_000, 100_000, 200_000, 400_000, 800_000],
      effects: [0.9, 0.8, 0.7, 0.6, 0.5],
    },
    equipmentQuality: {
      id: 'equipmentQuality',
      name: 'Качество оборудования',
      description: 'Повышает базовое качество обслуживания',
      maxLevel: 5,
      prices: [80_000, 160_000, 320_000, 640_000, 1_200_000],
      effects: [1.1, 1.2, 1.3, 1.4, 1.5],
    },
    reliability: {
      id: 'reliability',
      name: 'Надёжность оборудования',
      description: 'Снижает вероятность поломок',
      maxLevel: 5,
      prices: [60_000, 120_000, 240_000, 480_000, 960_000],
      effects: [0.8, 0.6, 0.45, 0.3, 0.15],
    },
    capacity: {
      id: 'capacity',
      name: 'Пропускная способность',
      description: 'Увеличивает максимум машин в очереди',
      maxLevel: 3,
      prices: [150_000, 300_000, 600_000],
      effects: [8, 10, 12],
    },
    supplyEfficiency: {
      id: 'supplyEfficiency',
      name: 'Экономия материалов',
      description: 'Снижает расход материалов на мойку',
      maxLevel: 5,
      prices: [40_000, 80_000, 160_000, 320_000, 640_000],
      effects: [0.9, 0.8, 0.7, 0.6, 0.5],
    },
  },

  // Поломки
  breakdown: {
    baseChancePerWash: 0.03,
    repairCostBase: 15_000,
    repairTime: 5000,
  },

  // Маркетинг
  marketing: {
    campaignCost: 30_000,
    campaignDuration: 3,
    customerFlowBoost: 1.5,
  },

  // Программа лояльности
  loyalty: {
    setupCost: 20_000,
    repeatBoost: 0.15,
  },

  // Конкурент
  competitor: {
    appearDay: 4,
    priceWarDay: 5,
    priceWarPrice: 100,
    buyoutOfferDay: 8,
    buyoutPrice: 1_200_000,
    demandReductionDuringWar: 0.4,
  },

  // Репутация
  reputation: {
    initial: 50,
    min: 0,
    max: 100,
    goodServiceBonus: 2,
    poorServicePenalty: -3,
    missedCustomerPenalty: -1,
    perfectBonus: 5,
  },

  // Время
  time: {
    shiftDurationMs: 180_000,
    dayStartHour: 8,
    dayEndHour: 20,
  },
};

export default BALANCE;
