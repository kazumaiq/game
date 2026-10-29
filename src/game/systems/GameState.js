/**
 * GameState — единый источник истины для всех игровых данных.
 * Поддерживает кастомную смету запуска, систему документов (СЭС, МЧС, Экология, Водоканал),
 * проверки с санкциями, запасы расходных материалов.
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
    this.equipmentType = 'used'; // 'used', 'newStandard', 'premiumAuto'
    this.reputation = BALANCE.reputation.initial;

    // Оформленные документы
    this.documents = {
      ses: false,
      fire: false,
      ecology: false,
      vodokanal: false,
    };

    // Запасы автохимии (число моек)
    this.suppliesStock = 50;
    this.chemistryStock = { basic: 50, proFoam: 0, wheelCleaner: 0, wax: 0, ceramic: 0, interior: 0 };
    this.activeServicePackage = 'standard';
    this.unlockedServices = ['wash'];
    this.businessUpgrades = { extraBay: 0, waterFilter: 0, dryer: 0, chemicalDoser: 0, detailing: 0, tireService: 0, sto: 0, coffeeShop: 0 };
    this.cityPlots = { roadside: true, residential: false, business: false, industrial: false };
    this.weather = 'clear';
    this.customerSegments = { regular: 0, taxi: 0, premium: 0, fleet: 0 };

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
      todayPerfectWashes: 0,
    };

    this.dailyContractDay = 0;
    this.dailyContracts = [];
    this.financialLog = [];
    this.storyFlags = {};
    this.tutorialCompleted = false;
    this.tutorialStep = 0;
    this.tutorialCarId = null;

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

    this.saveVersion = 6;
    this.shiftEndProcessing = false;
  }

  /**
   * Инициализация новой игры с выбором локации, оборудования и опциональных документов
   */
  initNewGame(locationId, customConfig = null) {
    this.reset();
    this.location = locationId;
    this.money = BALANCE.startingCapital;

    let startupTotal = 0;
    let equipCost = BALANCE.startupCosts.equipment;

    if (customConfig && customConfig.equipment) {
      this.equipmentType = customConfig.equipment;
      const opt = BALANCE.equipmentOptions[customConfig.equipment];
      if (opt) equipCost = opt.cost;
    }

    // Базовые расходы за вычетом оборудования
    const baseFixed = BALANCE.startupCosts.deposit +
      BALANCE.startupCosts.permits +
      BALANCE.startupCosts.construction +
      BALANCE.startupCosts.utilities +
      BALANCE.startupCosts.supplies +
      BALANCE.startupCosts.signage;

    startupTotal = baseFixed + equipCost;

    // Оформление стартовых документов, если выбрано в мастере
    if (customConfig && customConfig.docs) {
      for (const [docId, selected] of Object.entries(customConfig.docs)) {
        if (selected && BALANCE.documents[docId]) {
          this.documents[docId] = true;
          startupTotal += BALANCE.documents[docId].cost;
          this._logFinance('expense', `Лицензия: ${BALANCE.documents[docId].name}`, BALANCE.documents[docId].cost);
        }
      }
    }

    this.money -= startupTotal;
    this._logFinance('expense', 'Подготовка и открытие автомойки', startupTotal);

    this.initialized = true;
    this.day = 1;
    this.shiftActive = true;
    this.shiftTimeRemaining = BALANCE.time.shiftDurationMs;
    this._refreshDailyContracts();
    this.emit('stateChanged');
  }

  /** Получить параметры текущей локации */
  getLocation() {
    return this.location ? BALANCE.locations[this.location] : null;
  }

  /** Покупка/оформление документа */
  buyDocument(docId) {
    const docDef = BALANCE.documents[docId];
    if (!docDef) return { success: false, reason: 'Неизвестный документ' };
    if (this.documents[docId]) return { success: false, reason: 'Документ уже оформлен' };
    if (this.money < docDef.cost) return { success: false, reason: 'Недостаточно средств' };

    this.money -= docDef.cost;
    this.documents[docId] = true;
    this.stats.totalExpenses += docDef.cost;
    this.stats.todayExpenses += docDef.cost;
    this._logFinance('expense', `Оформление: ${docDef.name}`, docDef.cost);
    this.emit('stateChanged');
    return { success: true, doc: docDef };
  }

  /** Закупка автохимии (партия на 50 моек) */
  buySuppliesStock() {
    const cost = 25_000;
    if (this.money < cost) return { success: false, reason: 'Недостаточно средств' };
    this.money -= cost;
    this.suppliesStock += 50;
    this.chemistryStock.basic = (this.chemistryStock.basic || 0) + 50;
    this.stats.totalExpenses += cost;
    this.stats.todayExpenses += cost;
    this._logFinance('expense', 'Закупка автохимии (50 комплектов)', cost);
    this.emit('stateChanged');
    return { success: true, newStock: this.suppliesStock };
  }

  /** Доход за оказанную услугу */
  addServiceIncome(carId, quality) {
    const car = this.cars.find(c => c.id === carId);
    if (!car || car.paid) return 0;

    const carClass = BALANCE.carClasses[car.carClass];
    const packageDefs = {
      standard: { surcharge: 0, chemistry: 'basic', costMult: 1 },
      foam: { surcharge: 250, chemistry: 'proFoam', costMult: 1.35 },
      wax: { surcharge: 450, chemistry: 'wax', costMult: 1.6 },
      ceramic: { surcharge: 1800, chemistry: 'ceramic', costMult: 2.5 },
      interior: { surcharge: 700, chemistry: 'interior', costMult: 1.8 },
    };
    const servicePackage = packageDefs[this.activeServicePackage] || packageDefs.standard;
    const price = Math.round((this.servicePrice + servicePackage.surcharge) * carClass.priceMultiplier);
    const supplyCostMult = this.getUpgradeEffect('supplyEfficiency', 1);
    const supplyCost = Math.round(
      BALANCE.services.expressWash.supplyCost * carClass.supplyCostMultiplier * supplyCostMult * servicePackage.costMult
    );
    const chemistryKey = servicePackage.chemistry;
    const hasChemistry = (this.chemistryStock[chemistryKey] || 0) > 0 || (chemistryKey === 'basic' && this.suppliesStock > 0);
    if (!hasChemistry) {
      this.changeReputation(-1);
      this.emit('stateChanged');
      return 0;
    }
    if (this.chemistryStock[chemistryKey] > 0) this.chemistryStock[chemistryKey]--;
    if (chemistryKey === 'basic' && this.suppliesStock > 0) this.suppliesStock--;


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

    if (quality >= 0.85) {
      this.stats.todayPerfectWashes++;
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
    if (!loc) return 0;

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

    this._logFinance('expense', 'Аренда за смену', rent);
    this._logFinance('expense', 'Коммунальные платежи', utilities);
    if (salaries > 0) {
      this._logFinance('expense', `Зарплата (${this.employees.length} сотр.)`, salaries);
    }

    this.emit('stateChanged');
    return total;
  }

  /** Проверка инспекций на текущий день */
  checkInspections() {
    const insp = BALANCE.inspections.find(i => i.day === this.day);
    if (!insp) return null;

    const hasDoc = this.documents[insp.type];
    const docDef = BALANCE.documents[insp.type];

    if (!hasDoc) {
      // Нарушение: штраф
      const fine = docDef ? docDef.fine : 100_000;
      this.money -= fine;
      this.stats.totalExpenses += fine;
      this.stats.todayExpenses += fine;
      this.changeReputation(-10);
      this._logFinance('expense', `ШТРАФ: ${insp.name} (нет документа)`, fine);
      this.emit('stateChanged');
      return { passed: false, insp, fine, docDef };
    }

    // Проверка пройдена
    this.changeReputation(5);
    return { passed: true, insp, docDef };
  }

  /** Выбор пакета обслуживания влияет на цену и расход химии. */
  setServicePackage(packageId) {
    const packages = {
      standard: { surcharge: 0, name: 'Стандарт', chemistry: 'basic' },
      foam: { surcharge: 250, name: 'Активная пена PRO', chemistry: 'proFoam' },
      wax: { surcharge: 450, name: 'Мойка + воск', chemistry: 'wax' },
      ceramic: { surcharge: 1800, name: 'Керамическая защита', chemistry: 'ceramic' },
      interior: { surcharge: 700, name: 'Комплекс с салоном', chemistry: 'interior' },
    };
    const def = packages[packageId];
    if (!def) return { success: false, reason: 'Пакет не найден' };
    if (packageId !== 'standard' && !(this.chemistryStock[def.chemistry] > 0)) return { success: false, reason: 'Нет нужной химии на складе' };
    this.activeServicePackage = packageId;
    this.emit('stateChanged');
    return { success: true, package: def };
  }

  /** Приобретение оборудования и открытие новых направлений бизнеса. */
  buyBusinessUpgrade(upgradeId) {
    const catalog = {
      extraBay: { name: 'Дополнительный пост', cost: 850000, max: 2 },
      waterFilter: { name: 'Система фильтрации воды', cost: 240000, max: 1 },
      dryer: { name: 'Автоматическая сушка', cost: 380000, max: 1 },
      chemicalDoser: { name: 'Автоматический дозатор химии', cost: 290000, max: 1 },
      detailing: { name: 'Студия детейлинга', cost: 1200000, max: 1, service: 'detailing' },
      tireService: { name: 'Шиномонтаж', cost: 950000, max: 1, service: 'tireService' },
      sto: { name: 'СТО: ремонтный бокс', cost: 2200000, max: 1, service: 'sto' },
      coffeeShop: { name: 'Кофейня для клиентов', cost: 550000, max: 1, service: 'coffeeShop' },
    };
    const def = catalog[upgradeId];
    if (!def) return { success: false, reason: 'Объект не найден' };
    const level = this.businessUpgrades[upgradeId] || 0;
    if (level >= def.max) return { success: false, reason: 'Уже приобретено максимум улучшений' };
    if (this.money < def.cost) return { success: false, reason: 'Недостаточно средств' };
    this.money -= def.cost;
    this.businessUpgrades[upgradeId] = level + 1;
    if (def.service && !this.unlockedServices.includes(def.service)) this.unlockedServices.push(def.service);
    this.stats.totalExpenses += def.cost;
    this.stats.todayExpenses += def.cost;
    this._logFinance('expense', `Развитие бизнеса: ${def.name}`, def.cost);
    this.emit('stateChanged');
    return { success: true, upgrade: def, level: level + 1 };
  }

  /** Покупка участка на карте города. */
  buyCityPlot(plotId) {
    const catalog = {
      residential: { name: 'Жилой район', cost: 1800000 },
      business: { name: 'Деловой центр', cost: 3200000 },
      industrial: { name: 'Промзона', cost: 1400000 },
    };
    const def = catalog[plotId];
    if (!def) return { success: false, reason: 'Участок не найден' };
    if (this.cityPlots[plotId]) return { success: false, reason: 'Участок уже открыт' };
    if (this.money < def.cost) return { success: false, reason: 'Недостаточно средств' };
    this.money -= def.cost;
    this.cityPlots[plotId] = true;
    this.stats.totalExpenses += def.cost;
    this.stats.todayExpenses += def.cost;
    this._logFinance('expense', `Покупка участка: ${def.name}`, def.cost);
    this.emit('stateChanged');
    return { success: true, plot: def };
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
      status: 'idle',
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
      state: 'waiting',
      washStage: -1,
      washProgress: 0,
      quality: 0,
      paid: false,
      completed: false,
      patience: BALANCE.customer.basePatience + (Math.random() * 2 - 1) * BALANCE.customer.patienceVariance,
      waitTime: 0,
      postId: null,
    };

    this.cars.push(car);
    this.queue.push(car.id);
    this.emit('carAdded', car);
    return car;
  }

  removeCar(carId) {
    this.queue = this.queue.filter(id => id !== carId);
    this.cars = this.cars.filter(c => c.id !== carId);
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

  _refreshDailyContracts(savedContracts = null) {
    const day = Math.max(1, Math.floor(Number(this.day) || 1));
    const previousClaims = new Map(
      (Array.isArray(savedContracts) ? savedContracts : [])
        .filter(contract => contract && typeof contract.id === 'string' && contract.claimed)
        .map(contract => [contract.id, true])
    );

    const washTarget = day % 2 === 0 ? 4 : 3;
    const revenueTarget = 1500 + (day % 3) * 500;
    const perfectTarget = day % 2 === 0 ? 1 : 2;

    const definitions = [
      {
        id: 'wash',
        title: 'Поток клиентов',
        description: `Вымой ${washTarget} автомобиля за смену`,
        target: washTarget,
        progressKey: 'todayCarsWashed',
        reward: 8000 + ((day - 1) % 4) * 1000,
      },
      {
        id: 'revenue',
        title: 'План продаж',
        description: `Получи ${revenueTarget.toLocaleString('ru-RU')} ₽ выручки от моек`,
        target: revenueTarget,
        progressKey: 'todayRevenue',
        reward: 10000 + ((day - 1) % 3) * 1000,
      },
      {
        id: 'quality',
        title: 'Безупречный сервис',
        description: `Выполни ${perfectTarget} ${perfectTarget === 1 ? 'мойку' : 'мойки'} с качеством от 85%`,
        target: perfectTarget,
        progressKey: 'todayPerfectWashes',
        reward: 12000 + ((day - 1) % 4) * 1000,
      },
    ];

    this.dailyContractDay = day;
    this.dailyContracts = definitions.map(contract => ({
      ...contract,
      claimed: previousClaims.get(contract.id) === true,
    }));
  }

  getDailyContracts() {
    if (this.dailyContractDay !== this.day || !Array.isArray(this.dailyContracts) || this.dailyContracts.length !== 3) {
      this._refreshDailyContracts();
    }

    return this.dailyContracts.map(contract => {
      const rawProgress = Number(this.stats[contract.progressKey]) || 0;
      const progress = Math.max(0, contract.progressKey === 'todayRevenue' ? rawProgress : Math.floor(rawProgress));
      const completed = progress >= contract.target;
      return {
        ...contract,
        progress,
        completed,
        claimable: completed && !contract.claimed,
      };
    });
  }

  claimDailyContract(contractId) {
    const contract = this.getDailyContracts().find(item => item.id === contractId);
    if (!contract) return { success: false, reason: 'Контракт не найден' };
    if (contract.claimed) return { success: false, reason: 'Награда уже получена' };
    if (!contract.completed) return { success: false, reason: 'Контракт ещё не выполнен' };

    const stored = this.dailyContracts.find(item => item.id === contractId);
    if (!stored) return { success: false, reason: 'Контракт не найден' };

    stored.claimed = true;
    this.money += stored.reward;
    this.stats.totalRevenue += stored.reward;
    this._logFinance('income', `Награда за контракт «${stored.title}»`, stored.reward);
    this.emit('stateChanged');

    return { success: true, reward: stored.reward, title: stored.title };
  }

  nextDay() {
    this.day++;
    this.shiftTimeRemaining = BALANCE.time.shiftDurationMs;
    this.stats.todayCarsWashed = 0;
    this.stats.todayRevenue = 0;
    this.stats.todayExpenses = 0;
    this.stats.todayPerfectWashes = 0;
    this._refreshDailyContracts();

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

  changeReputation(amount) {
    this.reputation = Math.max(
      BALANCE.reputation.min,
      Math.min(BALANCE.reputation.max, this.reputation + amount)
    );
  }

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

  setServicePrice(newPrice) {
    const { minPrice, maxPrice } = BALANCE.services.expressWash;
    newPrice = Math.round(newPrice);
    if (newPrice < minPrice || newPrice > maxPrice) return false;
    this.servicePrice = newPrice;
    this.emit('stateChanged');
    return true;
  }

  setStoryFlag(flag, value = true) {
    if (this.storyFlags[flag]) return false;
    this.storyFlags[flag] = value;
    this.emit('stateChanged');
    return true;
  }

  hasStoryFlag(flag) {
    return !!this.storyFlags[flag];
  }

  advanceTutorial(expectedCurrentStep) {
    if (this.tutorialCompleted) return false;
    if (expectedCurrentStep !== undefined && this.tutorialStep !== expectedCurrentStep) return false;
    this.tutorialStep++;
    this.emit('stateChanged');
    this.emit('tutorialStepChanged', this.tutorialStep);
    return true;
  }

  completeTutorial() {
    this.tutorialCompleted = true;
    this.tutorialStep = 4;
    this.emit('stateChanged');
    this.emit('tutorialCompleted');
    return true;
  }

  isTutorialActive() {
    return !this.tutorialCompleted;
  }

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
    if (!post || !post.broken) return { success: false, reason: 'Бокс исправен' };
    const cost = BALANCE.breakdown.repairCostBase;
    if (this.money < cost) return { success: false, reason: 'Недостаточно средств' };
    this.money -= cost;
    this.stats.totalExpenses += cost;
    this.stats.todayExpenses += cost;
    this._logFinance('expense', `Ремонт бокса`, cost);
    post.broken = false;
    this.emit('stateChanged');
    return { success: true };
  }

  getDemandMultiplier() {
    const loc = this.getLocation();
    if (!loc) return 1;
    let mult = loc.customerFlow;

    mult *= 0.5 + (this.reputation / 100) * 1.0;

    const priceRatio = this.servicePrice / BALANCE.services.expressWash.basePrice;
    mult *= Math.max(0.3, 1.5 - priceRatio * 0.5);

    if (this.marketingActive) {
      mult *= BALANCE.marketing.customerFlowBoost;
    }

    if (this.competitorPriceWar) {
      mult *= (1 - BALANCE.competitor.demandReductionDuringWar);
    }

    return Math.max(0.1, mult);
  }

  _logFinance(type, description, amount) {
    this.financialLog.push({
      id: genId('fin'),
      type,
      description,
      amount,
      day: this.day,
      timestamp: Date.now(),
    });
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

  serialize() {
    return {
      saveVersion: this.saveVersion,
      initialized: this.initialized,
      day: this.day,
      money: this.money,
      location: this.location,
      equipmentType: this.equipmentType,
      documents: { ...this.documents },
      suppliesStock: this.suppliesStock,
      chemistryStock: { ...this.chemistryStock },
      activeServicePackage: this.activeServicePackage,
      unlockedServices: [...this.unlockedServices],
      businessUpgrades: { ...this.businessUpgrades },
      cityPlots: { ...this.cityPlots },
      weather: this.weather,
      customerSegments: { ...this.customerSegments },
      reputation: this.reputation,
      upgrades: { ...this.upgrades },
      employees: this.employees.map(e => ({ ...e })),
      servicePrice: this.servicePrice,
      stats: { ...this.stats },
      dailyContractDay: this.dailyContractDay,
      dailyContracts: this.dailyContracts.map(contract => ({ ...contract })),
      financialLog: this.financialLog.slice(-100),
      storyFlags: { ...this.storyFlags },
      tutorialCompleted: this.tutorialCompleted,
      tutorialStep: this.tutorialStep,
      tutorialCarId: this.tutorialCarId,
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

  deserialize(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.saveVersion || !data.initialized) return false;

    this.reset();
    this.saveVersion = data.saveVersion;
    this.initialized = data.initialized;
    this.day = data.day || 1;
    this.dailyContractDay = typeof data.dailyContractDay === 'number' ? data.dailyContractDay : 0;
    this.dailyContracts = Array.isArray(data.dailyContracts) ? data.dailyContracts : [];
    this.money = typeof data.money === 'number' && isFinite(data.money) ? data.money : BALANCE.startingBalance;
    this.location = data.location;
    this.equipmentType = data.equipmentType || 'used';

    if (data.documents && typeof data.documents === 'object') {
      this.documents = { ...this.documents, ...data.documents };
    }
    if (typeof data.suppliesStock === 'number') {
      this.suppliesStock = data.suppliesStock;
    }
    if (data.chemistryStock && typeof data.chemistryStock === 'object') this.chemistryStock = { ...this.chemistryStock, ...data.chemistryStock };
    if (typeof data.activeServicePackage === 'string') this.activeServicePackage = data.activeServicePackage;
    if (Array.isArray(data.unlockedServices)) this.unlockedServices = [...new Set(['wash', ...data.unlockedServices])];
    if (data.businessUpgrades && typeof data.businessUpgrades === 'object') this.businessUpgrades = { ...this.businessUpgrades, ...data.businessUpgrades };
    if (data.cityPlots && typeof data.cityPlots === 'object') this.cityPlots = { ...this.cityPlots, ...data.cityPlots };
    if (['clear', 'rain', 'snow'].includes(data.weather)) this.weather = data.weather;
    if (data.customerSegments && typeof data.customerSegments === 'object') this.customerSegments = { ...this.customerSegments, ...data.customerSegments };

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
    this.tutorialStep = typeof data.tutorialStep === 'number' ? data.tutorialStep : 0;
    this.tutorialCarId = data.tutorialCarId || null;
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

    const savedContractState = this.dailyContractDay === this.day ? this.dailyContracts : null;
    this._refreshDailyContracts(savedContractState);

    this.shiftActive = true;
    this.shiftTimeRemaining = BALANCE.time.shiftDurationMs;
    this.emit('stateChanged');
    return true;
  }

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

export const gameState = new GameState();
export default gameState;
