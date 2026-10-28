/**
 * GameState — единый источник истины для всех игровых данных.
 * Ни UI, ни Phaser не изменяют данные напрямую — только через методы GameState.
 */
import BALANCE from '../config/balance.js';

let _nextId = 1;
function genId(prefix = 'op') {
  return `${prefix}_${Date.now()}_${_nextId++}`;
}

class GameState {
  constructor() {
    this.reset();
    this._listeners = {};
  }

  reset() {
    this.initialized = false;
    this.day = 1;
    this.shiftActive = false;
    this.shiftTimeRemaining = BALANCE.time.shiftDurationMs;
    this.paused = false;

    this.money = 0;
    this.location = null;
    this.reputation = BALANCE.reputation.initial;

    this.upgrades = {};
    for (const key of Object.keys(BALANCE.upgrades)) {
      this.upgrades[key] = 0;
    }

    this.employees = [];
    this.cars = [];
    this.queue = [];
    this.posts = [
      { id: 'post_1', busy: false, carId: null, broken: false },
      { id: 'post_2', busy: false, carId: null, broken: false },
    ];

    this.servicePrice = BALANCE.services.expressWash.basePrice;

    this.stats = {
      totalCarsWashed: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      todayCarsWashed: 0,
      todayRevenue: 0,
      todayExpenses: 0,
    };

    this.financialLog = [];
    this.storyFlags = {};
    this.tutorialCompleted = false;
    this.tutorialStep = 0;

    this.marketingActive = false;
    this.marketingDaysLeft = 0;
    this.loyaltyActive = false;

    this.competitorActive = false;
    this.competitorPriceWar = false;
    this.buyoutOffered = false;
    this.buyoutAccepted = false;

    this.settings = {
      soundEnabled: true,
      musicVolume: 0.5,
      sfxVolume: 0.7,
    };

    this.saveVersion = 3;
    this.shiftEndProcessing = false;
  }

  /** Инициализация новой игры */
  initNewGame(locationId) {
    this.reset();
    this.location = locationId;
    this.money = BALANCE.startingCapital;

    // Списать стартовые расходы ОДИН раз
    const startupTotal = BALANCE.totalStartupCost;
    this.money -= startupTotal;
    this._logFinance('expense', 'Расходы на запуск', startupTotal);
    this.initialized = true;
    this.day = 1;
    this.shiftActive = true;
    this.shiftTimeRemaining = BALANCE.time.shiftDurationMs;
    this.emit('stateChanged');
  }

  /** Получить параметры текущей локации */
  getLocation() {
    return this.location ? BALANCE.locations[this.location] : null;
  }

  /** Доход за оказанную услугу */
  addServiceIncome(carId, quality) {
    const car = this.cars.find(c => c.id === carId);
    if (!car || car.paid) return 0;

    const carClass = BALANCE.carClasses[car.carClass];
    const price = Math.round(this.servicePrice * carClass.priceMultiplier);
    const supplyCostMult = this.getUpgradeEffect('supplyEfficiency', 1);
    const supplyCost = Math.round(
      BALANCE.services.expressWash.supplyCost * carClass.supplyCostMultiplier * supplyCostMult
    );

    this.money += price;
    this.money -= supplyCost;

    car.paid = true;
    car.completed = true;

    this.stats.totalCarsWashed++;
    this.stats.totalRevenue += price;
    this.stats.totalExpenses += supplyCost;
    this.stats.todayCarsWashed++;
    this.stats.todayRevenue += price;
    this.stats.todayExpenses += supplyCost;

    this._logFinance('income', `Мойка ${carClass.name}`, price);
    this._logFinance('expense', `Материалы (${carClass.name})`, supplyCost);

    // Репутация
    if (quality >= 0.9) {
      this.changeReputation(BALANCE.reputation.goodServiceBonus);
    } else if (quality < 0.5) {
      this.changeReputation(BALANCE.reputation.poorServicePenalty);
    }

    this.emit('stateChanged');
    return price - supplyCost;
  }

  /** Ежедневные расходы (конец смены) */
  applyDailyExpenses() {
    const loc = this.getLocation();
    if (!loc) return;

    const rent = loc.dailyRent;
    const utilities = BALANCE.dailyCosts.utilities;
    let salaries = 0;
    for (const emp of this.employees) {
      salaries += BALANCE.employee.dailySalary;
    }

    const total = rent + utilities + salaries;

    this.money -= total;
    this.stats.totalExpenses += total;
    this.stats.todayExpenses += total;

    this._logFinance('expense', 'Аренда (день)', rent);
    this._logFinance('expense', 'Коммунальные', utilities);
    if (salaries > 0) {
      this._logFinance('expense', `Зарплаты (${this.employees.length} чел.)`, salaries);
    }

    this.emit('stateChanged');
    return total;
  }

  /** Покупка улучшения */
  buyUpgrade(upgradeId) {
    const def = BALANCE.upgrades[upgradeId];
    if (!def) return { success: false, reason: 'Улучшение не найдено' };

    const currentLevel = this.upgrades[upgradeId] || 0;
    if (currentLevel >= def.maxLevel) {
      return { success: false, reason: 'Максимальный уровень' };
    }

    const price = def.prices[currentLevel];
    if (this.money < price) {
      return { success: false, reason: 'Недостаточно средств' };
    }

    this.money -= price;
    this.upgrades[upgradeId] = currentLevel + 1;
    this.stats.totalExpenses += price;
    this.stats.todayExpenses += price;
    this._logFinance('expense', `Улучшение: ${def.name} (ур. ${currentLevel + 1})`, price);
    this.emit('stateChanged');
    return { success: true, newLevel: currentLevel + 1 };
  }

  /** Получить эффект улучшения */
  getUpgradeEffect(upgradeId, defaultValue = 1) {
    const def = BALANCE.upgrades[upgradeId];
    if (!def) return defaultValue;
    const level = this.upgrades[upgradeId] || 0;
    if (level === 0) return defaultValue;
    return def.effects[level - 1];
  }

  /** Нанять сотрудника */
  hireEmployee() {
    if (this.employees.length >= BALANCE.employee.maxEmployees) {
      return { success: false, reason: 'Максимум сотрудников' };
    }
    const emp = {
      id: genId('emp'),
      name: this._generateEmployeeName(),
      speed: BALANCE.employee.baseSpeed,
      quality: BALANCE.employee.baseQuality,
      status: 'idle', // idle, working, unavailable
      assignedPost: null,
      assignedCar: null,
    };
    this.employees.push(emp);
    this.emit('stateChanged');
    return { success: true, employee: emp };
  }

  /** Уволить сотрудника */
  fireEmployee(empId) {
    const idx = this.employees.findIndex(e => e.id === empId);
    if (idx === -1) return false;
    const emp = this.employees[idx];
    // Освободить пост
    if (emp.assignedPost) {
      const post = this.posts.find(p => p.id === emp.assignedPost);
      if (post) {
        post.busy = false;
        post.carId = null;
      }
    }
    this.employees.splice(idx, 1);
    this.emit('stateChanged');
    return true;
  }

  /** Добавить машину в очередь */
  addCar(carClassId) {
    const maxQueue = this.getUpgradeEffect('capacity', BALANCE.customer.maxQueueSize);
    if (this.queue.length >= maxQueue) return null;
    if (this.cars.length >= BALANCE.customer.maxActiveCars) return null;

    const carClass = BALANCE.carClasses[carClassId];
    if (!carClass) return null;

    const car = {
      id: genId('car'),
      carClass: carClassId,
      state: 'waiting',       // waiting, washing, done, leaving
      washStage: -1,           // -1 = не начата
      washProgress: 0,        // 0-100
      quality: 0,
      paid: false,
      completed: false,
      patience: BALANCE.customer.basePatience +
        (Math.random() * 2 - 1) * BALANCE.customer.patienceVariance,
      waitTime: 0,
      postId: null,
      priceSensitivity: 0.3 + Math.random() * 0.7,
      expectedQuality: 0.3 + Math.random() * 0.5,
      isRepeat: false,
    };

    this.cars.push(car);
    this.queue.push(car.id);
    this.emit('carAdded', car);
    return car;
  }

  /** Удалить машину */
  removeCar(carId) {
    this.queue = this.queue.filter(id => id !== carId);
    this.cars = this.cars.filter(c => c.id !== carId);
    // Освободить пост
    for (const post of this.posts) {
      if (post.carId === carId) {
        post.busy = false;
        post.carId = null;
      }
    }
    this.emit('stateChanged');
  }

  getCar(carId) {
    return this.cars.find(c => c.id === carId);
  }

  /** Найти свободный пост */
  findFreePost() {
    return this.posts.find(p => !p.busy && !p.broken);
  }

  /** Назначить машину на пост */
  assignCarToPost(carId, postId) {
    const car = this.getCar(carId);
    const post = this.posts.find(p => p.id === postId);
    if (!car || !post || post.busy || post.broken) return false;

    post.busy = true;
    post.carId = carId;
    car.postId = postId;
    car.state = 'washing';
    this.queue = this.queue.filter(id => id !== carId);
    this.emit('stateChanged');
    return true;
  }

  /** Сменить день */
  nextDay() {
    this.day++;
    this.shiftTimeRemaining = BALANCE.time.shiftDurationMs;
    this.stats.todayCarsWashed = 0;
    this.stats.todayRevenue = 0;
    this.stats.todayExpenses = 0;

    // Маркетинг
    if (this.marketingActive) {
      this.marketingDaysLeft--;
      if (this.marketingDaysLeft <= 0) {
        this.marketingActive = false;
        this.marketingDaysLeft = 0;
      }
    }

    this.shiftActive = true;
    this.emit('newDay');
    this.emit('stateChanged');
  }

  /** Репутация */
  changeReputation(amount) {
    this.reputation = Math.max(
      BALANCE.reputation.min,
      Math.min(BALANCE.reputation.max, this.reputation + amount)
    );
  }

  /** Запустить маркетинговую кампанию */
  startMarketing() {
    if (this.marketingActive) return { success: false, reason: 'Кампания уже активна' };
    if (this.money < BALANCE.marketing.campaignCost) {
      return { success: false, reason: 'Недостаточно средств' };
    }
    this.money -= BALANCE.marketing.campaignCost;
    this.stats.totalExpenses += BALANCE.marketing.campaignCost;
    this.stats.todayExpenses += BALANCE.marketing.campaignCost;
    this.marketingActive = true;
    this.marketingDaysLeft = BALANCE.marketing.campaignDuration;
    this._logFinance('expense', 'Маркетинговая кампания', BALANCE.marketing.campaignCost);
    this.emit('stateChanged');
    return { success: true };
  }

  /** Программа лояльности */
  enableLoyalty() {
    if (this.loyaltyActive) return { success: false, reason: 'Уже активна' };
    if (this.money < BALANCE.loyalty.setupCost) {
      return { success: false, reason: 'Недостаточно средств' };
    }
    this.money -= BALANCE.loyalty.setupCost;
    this.stats.totalExpenses += BALANCE.loyalty.setupCost;
    this._logFinance('expense', 'Программа лояльности', BALANCE.loyalty.setupCost);
    this.loyaltyActive = true;
    this.emit('stateChanged');
    return { success: true };
  }

  /** Изменить цену */
  setServicePrice(newPrice) {
    const { minPrice, maxPrice } = BALANCE.services.expressWash;
    newPrice = Math.round(newPrice);
    if (newPrice < minPrice || newPrice > maxPrice) return false;
    this.servicePrice = newPrice;
    this.emit('stateChanged');
    return true;
  }

  /** Сюжетный флаг */
  setStoryFlag(flag, value = true) {
    if (this.storyFlags[flag]) return false; // уже установлен
    this.storyFlags[flag] = value;
    this.emit('stateChanged');
    return true;
  }

  hasStoryFlag(flag) {
    return !!this.storyFlags[flag];
  }

  /** Поломка */
  breakPost(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (!post || post.broken) return false;
    post.broken = true;
    post.busy = false;
    post.carId = null;
    this.emit('stateChanged');
    return true;
  }

  repairPost(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (!post || !post.broken) return { success: false, reason: 'Пост не сломан' };
    const cost = BALANCE.breakdown.repairCostBase;
    if (this.money < cost) return { success: false, reason: 'Недостаточно средств' };
    this.money -= cost;
    this.stats.totalExpenses += cost;
    this.stats.todayExpenses += cost;
    this._logFinance('expense', `Ремонт поста`, cost);
    post.broken = false;
    this.emit('stateChanged');
    return { success: true };
  }

  /** Получить множитель спроса */
  getDemandMultiplier() {
    const loc = this.getLocation();
    if (!loc) return 1;
    let mult = loc.customerFlow;

    // Репутация
    mult *= 0.5 + (this.reputation / 100) * 1.0;

    // Цена (чем выше цена, тем меньше спрос)
    const priceRatio = this.servicePrice / BALANCE.services.expressWash.basePrice;
    mult *= Math.max(0.3, 1.5 - priceRatio * 0.5);

    // Маркетинг
    if (this.marketingActive) {
      mult *= BALANCE.marketing.customerFlowBoost;
    }

    // Конкурент
    if (this.competitorPriceWar) {
      mult *= (1 - BALANCE.competitor.demandReductionDuringWar);
    }

    return Math.max(0.1, mult);
  }

  /** Финансовый лог */
  _logFinance(type, description, amount) {
    this.financialLog.push({
      id: genId('fin'),
      type,
      description,
      amount,
      day: this.day,
      timestamp: Date.now(),
    });
    // Лимитируем историю
    if (this.financialLog.length > 500) {
      this.financialLog = this.financialLog.slice(-400);
    }
  }

  _generateEmployeeName() {
    const names = ['Алексей', 'Дмитрий', 'Сергей', 'Андрей', 'Михаил', 'Николай', 'Павел', 'Иван'];
    const surnames = ['Петров', 'Иванов', 'Сидоров', 'Козлов', 'Морозов', 'Волков', 'Соколов'];
    return names[Math.floor(Math.random() * names.length)] + ' ' +
           surnames[Math.floor(Math.random() * surnames.length)];
  }

  /** Сериализация для сохранения */
  serialize() {
    return {
      saveVersion: this.saveVersion,
      initialized: this.initialized,
      day: this.day,
      money: this.money,
      location: this.location,
      reputation: this.reputation,
      upgrades: { ...this.upgrades },
      employees: this.employees.map(e => ({ ...e })),
      servicePrice: this.servicePrice,
      stats: { ...this.stats },
      financialLog: this.financialLog.slice(-100),
      storyFlags: { ...this.storyFlags },
      tutorialCompleted: this.tutorialCompleted,
      tutorialStep: this.tutorialStep,
      marketingActive: this.marketingActive,
      marketingDaysLeft: this.marketingDaysLeft,
      loyaltyActive: this.loyaltyActive,
      competitorActive: this.competitorActive,
      competitorPriceWar: this.competitorPriceWar,
      buyoutOffered: this.buyoutOffered,
      buyoutAccepted: this.buyoutAccepted,
      settings: { ...this.settings },
      posts: this.posts.map(p => ({ id: p.id, broken: p.broken })),
    };
  }

  /** Десериализация из сохранения */
  deserialize(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.saveVersion || !data.initialized) return false;

    this.reset();
    this.saveVersion = data.saveVersion;
    this.initialized = data.initialized;
    this.day = data.day || 1;
    this.money = typeof data.money === 'number' && isFinite(data.money) ? data.money : BALANCE.startingBalance;
    this.location = data.location;
    this.reputation = typeof data.reputation === 'number' ?
      Math.max(BALANCE.reputation.min, Math.min(BALANCE.reputation.max, data.reputation)) :
      BALANCE.reputation.initial;

    if (data.upgrades && typeof data.upgrades === 'object') {
      for (const key of Object.keys(BALANCE.upgrades)) {
        const val = data.upgrades[key];
        this.upgrades[key] = (typeof val === 'number' && val >= 0 && val <= BALANCE.upgrades[key].maxLevel) ? val : 0;
      }
    }

    this.employees = Array.isArray(data.employees) ? data.employees : [];
    this.servicePrice = typeof data.servicePrice === 'number' ? data.servicePrice : BALANCE.services.expressWash.basePrice;

    if (data.stats) this.stats = { ...this.stats, ...data.stats };
    if (Array.isArray(data.financialLog)) this.financialLog = data.financialLog;
    if (data.storyFlags) this.storyFlags = { ...data.storyFlags };

    this.tutorialCompleted = !!data.tutorialCompleted;
    this.tutorialStep = data.tutorialStep || 0;
    this.marketingActive = !!data.marketingActive;
    this.marketingDaysLeft = data.marketingDaysLeft || 0;
    this.loyaltyActive = !!data.loyaltyActive;
    this.competitorActive = !!data.competitorActive;
    this.competitorPriceWar = !!data.competitorPriceWar;
    this.buyoutOffered = !!data.buyoutOffered;
    this.buyoutAccepted = !!data.buyoutAccepted;

    if (data.settings) this.settings = { ...this.settings, ...data.settings };
    if (Array.isArray(data.posts)) {
      for (const savedPost of data.posts) {
        const post = this.posts.find(p => p.id === savedPost.id);
        if (post) post.broken = !!savedPost.broken;
      }
    }

    this.shiftActive = true;
    this.shiftTimeRemaining = BALANCE.time.shiftDurationMs;
    this.emit('stateChanged');
    return true;
  }

  // Простой event emitter
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  emit(event, data) {
    if (!this._listeners[event]) return;
    for (const fn of this._listeners[event]) {
      try { fn(data); } catch (e) { console.error('GameState event error:', e); }
    }
  }
}

// Синглтон
export const gameState = new GameState();
export default gameState;
