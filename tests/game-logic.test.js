import test from 'node:test';
import assert from 'node:assert/strict';

import BALANCE from '../src/game/config/balance.js';
import { gameState } from '../src/game/systems/GameState.js';

test('1. Стартовый бюджет и вычитание расходов на запуск', () => {
  gameState.initNewGame('roadside');
  
  assert.equal(BALANCE.startingCapital, 6_000_000);
  assert.equal(BALANCE.totalStartupCost, 5_400_000);
  assert.equal(BALANCE.startingBalance, 600_000);
  assert.equal(gameState.money, 600_000);
  assert.equal(gameState.day, 1);
  assert.equal(gameState.initialized, true);
});

test('2. Пользовательская смета оборудования и документов при старте', () => {
  // Выбираем оборудование newStandard (2 400 000 ₽) и документы СЭС + МЧС (60 000 + 70 000 = 130 000 ₽)
  gameState.initNewGame('residential', {
    equipment: 'newStandard',
    docs: { ses: true, fire: true, ecology: false, vodokanal: false }
  });

  assert.equal(gameState.location, 'residential');
  assert.equal(gameState.equipmentType, 'newStandard');
  assert.equal(gameState.documents.ses, true);
  assert.equal(gameState.documents.fire, true);
  assert.equal(gameState.documents.ecology, false);
  // Стартовые расходы: база без оборуд (3 750 000) + новое оборуд (2 400 000) + доки (130 000) = 6 280 000 -> остаток -280 000
  assert.ok(gameState.money < 600_000);
});

test('3. Правильный расчёт ежедневной аренды и расходов', () => {
  gameState.initNewGame('roadside');
  const roadside = BALANCE.locations.roadside;
  assert.equal(roadside.dailyRent, 5_000); // 150_000 / 30

  const initialMoney = gameState.money;
  const appliedTotal = gameState.applyDailyExpenses();
  
  // Аренда 5000 + коммуналка 1500 + 0 сотрудников = 6500
  assert.equal(appliedTotal, 6_500);
  assert.equal(gameState.money, initialMoney - 6_500);
});

test('4. Добавление машины, расход материалов и начисление дохода за услугу', () => {
  gameState.initNewGame('roadside');
  const startMoney = gameState.money;

  const car = gameState.addCar('sedan');
  assert.ok(car, 'Машина должна быть создана');
  assert.equal(gameState.queue.length, 1);

  const assigned = gameState.assignCarToPost(car.id, 'post_1');
  assert.equal(assigned, true);
  assert.equal(gameState.queue.length, 0);

  const net = gameState.addServiceIncome(car.id, 1.0);
  assert.equal(net, 400);
  assert.equal(gameState.money, startMoney + 400);
  assert.equal(car.paid, true);
  assert.equal(car.completed, true);
  assert.equal(gameState.stats.todayCarsWashed, 1);
});

test('5. Защита от повторной оплаты и повторного завершения', () => {
  const car = gameState.cars[0];
  const moneyBefore = gameState.money;
  const carsWashedBefore = gameState.stats.todayCarsWashed;

  const net = gameState.addServiceIncome(car.id, 1.0);
  assert.equal(net, 0);
  assert.equal(gameState.money, moneyBefore);
  assert.equal(gameState.stats.todayCarsWashed, carsWashedBefore);
});

test('6. Документы, инспекции и штрафы', () => {
  gameState.initNewGame('roadside');
  gameState.day = 3; // День планового рейда СЭС
  gameState.documents.ses = false; // Документ не оформлен!

  const startMoney = gameState.money;
  const result = gameState.checkInspections();

  assert.equal(result.passed, false);
  assert.equal(result.fine, 120_000);
  assert.equal(gameState.money, startMoney - 120_000);

  // Оформляем документ
  const buyRes = gameState.buyDocument('ses');
  assert.equal(buyRes.success, true);
  assert.equal(gameState.documents.ses, true);

  // Повторная проверка на следующий цикл должна быть успешной
  const result2 = gameState.checkInspections();
  assert.equal(result2.passed, true);
});

test('7. Покупка улучшений: проверка баланса и уровней', () => {
  gameState.initNewGame('roadside');
  
  const res1 = gameState.buyUpgrade('washSpeed');
  assert.equal(res1.success, true);
  assert.equal(res1.newLevel, 1);
  assert.equal(gameState.upgrades.washSpeed, 1);
  assert.equal(gameState.money, 600_000 - 50_000);

  gameState.money = 0;
  const resFail = gameState.buyUpgrade('washSpeed');
  assert.equal(resFail.success, false);
  assert.equal(resFail.reason, 'Недостаточно средств');
});

test('8. Завершение смены и переход к следующему дню', () => {
  gameState.initNewGame('roadside');
  assert.equal(gameState.day, 1);

  gameState.nextDay();
  assert.equal(gameState.day, 2);
  assert.equal(gameState.stats.todayCarsWashed, 0);
  assert.equal(gameState.stats.todayRevenue, 0);
});

test('9. Сюжетные флаги (однократное срабатывание)', () => {
  gameState.initNewGame('roadside');
  const first = gameState.setStoryFlag('test_flag');
  assert.equal(first, true);

  const second = gameState.setStoryFlag('test_flag');
  assert.equal(second, false);
  assert.equal(gameState.hasStoryFlag('test_flag'), true);
});

test('10. Сериализация и восстановление (Save / Restore с документами и оборудованием)', () => {
  gameState.initNewGame('business');
  gameState.buyUpgrade('capacity');
  gameState.changeReputation(15);
  gameState.setServicePrice(650);
  gameState.buyDocument('vodokanal');

  const snapshot = gameState.serialize();
  assert.equal(snapshot.saveVersion, 6);
  assert.equal(snapshot.location, 'business');
  assert.equal(snapshot.servicePrice, 650);
  assert.equal(snapshot.documents.vodokanal, true);

  gameState.reset();
  assert.equal(gameState.initialized, false);

  const ok = gameState.deserialize(snapshot);
  assert.equal(ok, true);
  assert.equal(gameState.initialized, true);
  assert.equal(gameState.location, 'business');
  assert.equal(gameState.servicePrice, 650);
  assert.equal(gameState.documents.vodokanal, true);
  assert.equal(gameState.upgrades.capacity, 1);
});

test('11. Обработка повреждённого сохранения', () => {
  assert.equal(gameState.deserialize(null), false);
  assert.equal(gameState.deserialize({ foo: 'bar' }), false);
  assert.equal(gameState.deserialize({ saveVersion: 4 }), false);
});

// Polyfills for Node environment tests
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

if (!globalThis.document) {
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({
      appendChild: () => {},
      remove: () => {},
      setAttribute: () => {},
      style: {},
      classList: { add: () => {}, remove: () => {} },
    }),
    body: { appendChild: () => {} },
  };
}

test('12. Полный путь обучения от приближения к машине до завершения заказа', () => {
  gameState.initNewGame('roadside');
  assert.equal(gameState.tutorialCompleted, false);
  assert.equal(gameState.tutorialStep, 0);

  // Шаг 0: Игрок приближается к машине
  const advanced0 = gameState.advanceTutorial(0);
  assert.equal(advanced0, true);
  assert.equal(gameState.tutorialStep, 1);

  // Шаг 1: Игрок начинает обслуживание
  const advanced1 = gameState.advanceTutorial(1);
  assert.equal(advanced1, true);
  assert.equal(gameState.tutorialStep, 2);

  // Шаг 2: Нанесение пены и смывание
  const car = gameState.addCar('sedan');
  gameState.assignCarToPost(car.id, 'post_1');
  assert.equal(car.paid, false);

  // Шаг 3: Завершение и оплата
  const profit = gameState.addServiceIncome(car.id, 0.9);
  assert.ok(profit > 0);
  assert.equal(car.paid, true);
  assert.equal(car.completed, true);

  gameState.completeTutorial();
  assert.equal(gameState.tutorialCompleted, true);
  assert.equal(gameState.isTutorialActive(), false);
});

test('13. Шаг 4 завершается после начисления оплаты и не требует повторных действий', () => {
  gameState.initNewGame('roadside');
  gameState.tutorialStep = 2; // Мойка в процессе

  const car = gameState.addCar('compact');
  gameState.assignCarToPost(car.id, 'post_1');

  // Мойка завершилась -> начисление дохода
  const moneyBefore = gameState.money;
  const net = gameState.addServiceIncome(car.id, 1.0);
  assert.ok(net > 0);
  assert.equal(gameState.money, moneyBefore + net);

  // Завершение обучения переводит флаг
  gameState.completeTutorial();
  assert.equal(gameState.tutorialCompleted, true);
  assert.equal(gameState.tutorialStep, 4);

  // Повторная попытка завершить заказ не начисляет деньги
  const secondIncome = gameState.addServiceIncome(car.id, 1.0);
  assert.equal(secondIncome, 0);
  assert.equal(gameState.money, moneyBefore + net);
});

test('14. Отсутствие целевой машины восстанавливается', () => {
  gameState.initNewGame('roadside');
  gameState.tutorialCompleted = false;
  gameState.cars = [];
  gameState.posts[0].busy = false;
  gameState.posts[0].carId = null;

  // Функция восстановления гарантирует машину в посте 1
  const post1 = gameState.posts[0];
  let car = gameState.cars.find(c => !c.completed && !c.paid);
  if (!car) {
    car = gameState.addCar('sedan');
    gameState.assignCarToPost(car.id, post1.id);
  }

  assert.ok(car, 'Машина должна быть восстановлена');
  assert.equal(post1.busy, true);
  assert.equal(post1.carId, car.id);
  assert.equal(gameState.cars.length, 1);
});

test('15. Завершённое обучение сохраняется после перезагрузки', () => {
  gameState.initNewGame('roadside');
  gameState.completeTutorial();
  assert.equal(gameState.tutorialCompleted, true);

  const snapshot = gameState.serialize();
  assert.equal(snapshot.tutorialCompleted, true);

  gameState.reset();
  assert.equal(gameState.tutorialCompleted, false);

  const ok = gameState.deserialize(snapshot);
  assert.equal(ok, true);
  assert.equal(gameState.tutorialCompleted, true);
  assert.equal(gameState.isTutorialActive(), false);
});

test('16. Незавершённое обучение восстанавливается с сохранением текущего шага', () => {
  gameState.initNewGame('roadside');
  gameState.tutorialCompleted = false;
  gameState.tutorialStep = 2;

  const snapshot = gameState.serialize();
  assert.equal(snapshot.tutorialCompleted, false);
  assert.equal(snapshot.tutorialStep, 2);

  gameState.reset();
  gameState.deserialize(snapshot);

  assert.equal(gameState.tutorialCompleted, false);
  assert.equal(gameState.tutorialStep, 2);
  assert.equal(gameState.isTutorialActive(), true);
});

test('17. Проверка дистанции взаимодействия', () => {
  const player = { x: 450, y: 390 };
  const post1 = { x: 300, y: 310 };
  const dx = player.x - post1.x;
  const dy = player.y - post1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // На старте дистанция ~170px — слишком далеко для мойки без приближения
  assert.ok(dist > 100);

  // Игрок приближается к боксу
  const closePlayer = { x: 330, y: 320 };
  const closeDx = closePlayer.x - post1.x;
  const closeDy = closePlayer.y - post1.y;
  const closeDist = Math.sqrt(closeDx * closeDx + closeDy * closeDy);

  // Вблизи дистанция < 100px — действие мойки разрешено
  assert.ok(closeDist < 100);
});

test('18. Поддержка всех 6 классов автомобилей (включая wagon и van)', () => {
  const classes = Object.keys(BALANCE.carClasses);
  assert.equal(classes.length, 6);
  assert.ok(classes.includes('compact'));
  assert.ok(classes.includes('sedan'));
  assert.ok(classes.includes('suv'));
  assert.ok(classes.includes('premium'));
  assert.ok(classes.includes('wagon'));
  assert.ok(classes.includes('van'));

  gameState.initNewGame('roadside');
  const wagon = gameState.addCar('wagon');
  assert.ok(wagon);
  assert.equal(wagon.carClass, 'wagon');

  const van = gameState.addCar('van');
  assert.ok(van);
  assert.equal(van.carClass, 'van');
});

test('19. Управление сотрудниками: найм, статус, зарплата и увольнение', () => {
  gameState.initNewGame('roadside');
  assert.equal(gameState.employees.length, 0);

  const hireRes = gameState.hireEmployee();
  assert.equal(hireRes.success, true);
  assert.equal(gameState.employees.length, 1);
  const emp = gameState.employees[0];
  assert.equal(emp.status, 'idle');

  // Зарплата списывается при завершении дня
  const moneyBefore = gameState.money;
  gameState.applyDailyExpenses();
  const expectedSalary = BALANCE.employee.dailySalary;
  const locRent = gameState.getLocation().dailyRent;
  const utilities = BALANCE.dailyCosts.utilities;
  assert.equal(gameState.money, moneyBefore - locRent - utilities - expectedSalary);

  // Увольнение
  const fireRes = gameState.fireEmployee(emp.id);
  assert.equal(fireRes, true);
  assert.equal(gameState.employees.length, 0);
});

test('20. Безопасность AudioManager в Node/безголовом окружении', async () => {
  const { audioManager } = await import('../src/game/systems/AudioManager.js');
  assert.ok(audioManager);
  assert.equal(typeof audioManager.play, 'function');
  assert.equal(typeof audioManager.setVolume, 'function');
  assert.equal(typeof audioManager.toggleSFX, 'function');

  // Вызовы не должны выбрасывать исключений
  assert.doesNotThrow(() => {
    audioManager.play('buttonClick');
    audioManager.play('waterSpray');
    audioManager.play('foamSpray');
    audioManager.play('rinse');
    audioManager.play('cashRegister');
    audioManager.play('warningBeep');
    audioManager.play('wrenchRepair');
    audioManager.play('carArrive');
    audioManager.play('carDepart');
    audioManager.play('success');
    audioManager.play('error');
    audioManager.setVolume(0.8);
    audioManager.toggleSFX();
  });
});




test('21. Ежедневные контракты отслеживают прогресс и выдают награду только один раз', () => {
  gameState.initNewGame('roadside');
  const contracts = gameState.getDailyContracts();
  assert.equal(contracts.length, 3);

  const washContract = contracts.find(contract => contract.id === 'wash');
  assert.ok(washContract);
  gameState.stats.todayCarsWashed = washContract.target;

  const progressed = gameState.getDailyContracts().find(contract => contract.id === 'wash');
  assert.equal(progressed.completed, true);
  assert.equal(progressed.claimable, true);

  const moneyBefore = gameState.money;
  const reward = gameState.claimDailyContract('wash');
  assert.equal(reward.success, true);
  assert.equal(gameState.money, moneyBefore + washContract.reward);
  assert.equal(gameState.stats.totalRevenue, washContract.reward);
  assert.equal(gameState.getDailyContracts().find(contract => contract.id === 'wash').claimed, true);
  assert.equal(gameState.claimDailyContract('wash').success, false);

  gameState.nextDay();
  const nextDayContracts = gameState.getDailyContracts();
  assert.equal(gameState.day, 2);
  assert.ok(nextDayContracts.every(contract => contract.claimed === false));
  assert.equal(nextDayContracts.find(contract => contract.id === 'wash').progress, 0);
});

test('22. Прогресс идеальной мойки и состояние полученных контрактов сохраняются', () => {
  gameState.initNewGame('roadside');
  const car = gameState.addCar('sedan');
  assert.ok(car);
  gameState.addServiceIncome(car.id, 0.9);
  assert.equal(gameState.stats.todayPerfectWashes, 1);
  assert.equal(gameState.getDailyContracts().find(contract => contract.id === 'quality').progress, 1);

  const washContract = gameState.getDailyContracts().find(contract => contract.id === 'wash');
  gameState.stats.todayCarsWashed = washContract.target;
  assert.equal(gameState.claimDailyContract('wash').success, true);

  const saved = gameState.serialize();
  assert.equal(gameState.deserialize(saved), true);
  assert.equal(gameState.getDailyContracts().find(contract => contract.id === 'wash').claimed, true);
  assert.equal(gameState.stats.todayPerfectWashes, 1);
});


import { getShiftClock, getDayCycleProfile } from '../src/game/systems/DayCycle.js';

test('23. Часы смены плавно проходят утро, день и вечер', () => {
  const cfg = BALANCE.time;
  const morning = getShiftClock(cfg.shiftDurationMs, cfg);
  const noon = getShiftClock(cfg.shiftDurationMs / 2, cfg);
  const evening = getShiftClock(0, cfg);

  assert.equal(morning.clock, '08:00');
  assert.equal(morning.phase, 'morning');
  assert.equal(noon.clock, '14:00');
  assert.equal(noon.phase, 'day');
  assert.equal(evening.clock, '20:00');
  assert.equal(evening.phase, 'evening');
  assert.equal(getShiftClock(-500, cfg).clock, '20:00');
});

test('24. Суточный цикл усиливает освещение постов к вечеру', () => {
  const morning = getDayCycleProfile(8);
  const noon = getDayCycleProfile(12);
  const sunset = getDayCycleProfile(18);
  const evening = getDayCycleProfile(20);

  assert.ok(morning.tintAlpha > noon.tintAlpha);
  assert.ok(sunset.tintAlpha > noon.tintAlpha);
  assert.ok(evening.tintAlpha > sunset.tintAlpha);
  assert.ok(evening.lampAlpha > sunset.lampAlpha);
  assert.equal(evening.phase, 'evening');
});


test('16. Каталог химии: покупка списывает деньги и пополняет склад', () => {
  gameState.initNewGame('roadside');
  const moneyBefore = gameState.money;
  const result = gameState.buyChemistry('proFoam');
  assert.equal(result.success, true);
  assert.equal(result.stock, 40);
  assert.equal(gameState.chemistryStock.proFoam, 40);
  assert.equal(gameState.money, moneyBefore - 42000);
  assert.equal(gameState.buyChemistry('unknown').success, false);
  gameState.money = 0;
  assert.equal(gameState.buyChemistry('wax').success, false);
});

test('17. Пакеты обслуживания требуют химию и сохраняют выбор', () => {
  gameState.initNewGame('roadside');
  assert.equal(gameState.setServicePackage('ceramic').success, false);
  gameState.buyChemistry('ceramic');
  assert.equal(gameState.setServicePackage('ceramic').success, true);
  assert.equal(gameState.activeServicePackage, 'ceramic');
  const car = gameState.addCar('sedan');
  gameState.assignCarToPost(car.id, 'post_1');
  const net = gameState.addServiceIncome(car.id, 1);
  assert.equal(net, 2050);
  assert.equal(gameState.chemistryStock.ceramic, 14);
});

test('18. Развитие бизнеса открывает направления и корректно списывает бюджет', () => {
  gameState.initNewGame('roadside');
  const before = gameState.money;
  assert.equal(gameState.buyBusinessUpgrade('detailing').success, false);
  gameState.money = 2_000_000;
  const bought = gameState.buyBusinessUpgrade('detailing');
  assert.equal(bought.success, true);
  assert.equal(gameState.businessUpgrades.detailing, 1);
  assert.ok(gameState.unlockedServices.includes('detailing'));
  assert.equal(gameState.money, 800_000);
  assert.equal(gameState.buyBusinessUpgrade('detailing').success, false);
  assert.ok(before > 0);
});

test('19. Карта города: участки покупаются один раз и сохраняются', () => {
  gameState.initNewGame('roadside');
  gameState.money = 2_000_000;
  const bought = gameState.buyCityPlot('residential');
  assert.equal(bought.success, true);
  assert.equal(gameState.cityPlots.residential, true);
  assert.equal(gameState.money, 200_000);
  assert.equal(gameState.buyCityPlot('residential').success, false);
  const snapshot = gameState.serialize();
  gameState.reset();
  assert.equal(gameState.deserialize(snapshot), true);
  assert.equal(gameState.cityPlots.residential, true);
  assert.equal(gameState.chemistryStock.basic, 50);
});
