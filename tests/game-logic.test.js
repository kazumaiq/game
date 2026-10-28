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
  assert.equal(snapshot.saveVersion, 4);
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
