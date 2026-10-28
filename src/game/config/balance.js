/**
 * Единая конфигурация игрового баланса.
 * Все цены, ставки и параметры — в одном месте.
 */

export const BALANCE = {
  // Стартовый капитал
  startingCapital: 6_000_000,

  // Расходы на запуск (фиксированные)
  startupCosts: {
    deposit: 300_000,       // Залог и первый месяц аренды
    permits: 250_000,       // Документы и разрешения
    construction: 2_100_000,// Подготовка территории
    equipment: 1_650_000,   // Два комплекта б/у оборудования
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

  // Локации
  locations: {
    roadside: {
      id: 'roadside',
      name: 'Придорожная территория',
      monthlyRent: 150_000,
      get dailyRent() { return Math.round(this.monthlyRent / 30); },
      customerFlow: 1.0,        // множитель базового потока
      repeatBonus: 0.0,         // бонус к повторным
      avgCheckMultiplier: 1.0,  // множитель среднего чека
      competitionPressure: 0.8, // давление конкуренции
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
      supplyCost: 100,
      minPrice: 100,
      maxPrice: 2000,
      stages: ['foam', 'rinse', 'finish'],
      stageNames: {
        foam: 'Нанесение пены',
        rinse: 'Смывание',
        finish: 'Финишная обработка',
      },
      baseDuration: 3000, // мс на этап (базовая)
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
  },

  // Клиенты
  customer: {
    basePatience: 30000,       // мс ожидания в очереди
    patienceVariance: 10000,   // ± мс
    spawnIntervalBase: 8000,   // мс между клиентами
    spawnIntervalVariance: 4000,
    maxQueueSize: 6,
    maxActiveCars: 8,
    repeatVisitBase: 0.2,      // базовый шанс повторного визита
  },

  // Сотрудники
  employee: {
    hireCost: 0,
    dailySalary: 3000,
    baseSpeed: 0.7,    // скорость относительно игрока (1.0)
    baseQuality: 0.75, // качество относительно игрока
    maxEmployees: 4,
  },

  // Ежедневные расходы
  dailyCosts: {
    utilities: 1500, // коммунальные за смену
  },

  // Улучшения
  upgrades: {
    washSpeed: {
      id: 'washSpeed',
      name: 'Скорость мойки',
      description: 'Уменьшает время каждого этапа мойки',
      maxLevel: 5,
      prices: [50_000, 100_000, 200_000, 400_000, 800_000],
      effects: [0.9, 0.8, 0.7, 0.6, 0.5], // множитель времени
    },
    equipmentQuality: {
      id: 'equipmentQuality',
      name: 'Качество оборудования',
      description: 'Повышает базовое качество обслуживания',
      maxLevel: 5,
      prices: [80_000, 160_000, 320_000, 640_000, 1_200_000],
      effects: [1.1, 1.2, 1.3, 1.4, 1.5], // множитель качества
    },
    reliability: {
      id: 'reliability',
      name: 'Надёжность оборудования',
      description: 'Снижает вероятность поломок',
      maxLevel: 5,
      prices: [60_000, 120_000, 240_000, 480_000, 960_000],
      effects: [0.8, 0.6, 0.45, 0.3, 0.15], // множитель шанса поломки
    },
    capacity: {
      id: 'capacity',
      name: 'Пропускная способность',
      description: 'Увеличивает максимум машин в очереди',
      maxLevel: 3,
      prices: [150_000, 300_000, 600_000],
      effects: [8, 10, 12], // новый макс. очереди
    },
    supplyEfficiency: {
      id: 'supplyEfficiency',
      name: 'Экономия материалов',
      description: 'Снижает расход материалов на мойку',
      maxLevel: 5,
      prices: [40_000, 80_000, 160_000, 320_000, 640_000],
      effects: [0.9, 0.8, 0.7, 0.6, 0.5], // множитель расхода
    },
  },

  // Поломки
  breakdown: {
    baseChancePerWash: 0.03,  // 3% за мойку при базовом уровне
    repairCostBase: 15_000,
    repairTime: 5000, // мс на ремонт
  },

  // Маркетинг
  marketing: {
    campaignCost: 30_000,
    campaignDuration: 3,        // дней
    customerFlowBoost: 1.5,     // множитель потока
  },

  // Программа лояльности
  loyalty: {
    setupCost: 20_000,
    repeatBoost: 0.15,          // прибавка к шансу повторного визита
  },

  // Конкурент
  competitor: {
    appearDay: 4,
    priceWarDay: 5,
    priceWarPrice: 100,
    buyoutOfferDay: 8,
    buyoutPrice: 1_200_000,
    demandReductionDuringWar: 0.4, // сколько спроса забирает конкурент
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
    shiftDurationMs: 180_000,   // 3 мин реального времени = 1 рабочий день
    dayStartHour: 8,
    dayEndHour: 20,
  },
};

export default BALANCE;
