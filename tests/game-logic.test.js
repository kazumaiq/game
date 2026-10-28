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

test('2. Правильный расчёт ежедневной аренды и расходов', () => {
  gameState.initNewGame('roadside');
  const roadside = BALANCE.locations.roadside;
  assert.equal(roadside.dailyRent, 5_000); // 150_000 / 30

  const initialMoney = gameState.money;
  const appliedTotal = gameState.applyDailyExpenses();
  
  // Аренда 5000 + коммуналка 1500 + 0 сотрудников = 6500
  assert.equal(appliedTotal, 6_500);
  assert.equal(gameState.money, initialMoney - 6_500);
});

test('3. Добавление машины, расход материалов и начисление дохода за услугу', () => {
  gameState.initNewGame('roadside');
  const startMoney = gameState.money;

  // Добавляем машину седан
  const car = gameState.addCar('sedan');
  assert.ok(car, 'Машина должна быть создана');
  assert.equal(gameState.queue.length, 1);

  // Назначаем на пост
  const assigned = gameState.assignCarToPost(car.id, 'post_1');
  assert.equal(assigned, true);
  assert.equal(gameState.queue.length, 0);

  // Оказываем услугу
  const net = gameState.addServiceIncome(car.id, 1.0);
  // Цена базовой экспресс мойки = 500, расход = 100, прибыль = 400
  assert.equal(net, 400);
  assert.equal(gameState.money, startMoney + 400);
  assert.equal(car.paid, true);
  assert.equal(car.completed, true);
  assert.equal(gameState.stats.todayCarsWashed, 1);
});

test('4. Защита от повторной оплаты и повторного завершения', () => {
  const car = gameState.cars[0];
  const moneyBefore = gameState.money;
  const carsWashedBefore = gameState.stats.todayCarsWashed;

  // Попытка повторной оплаты
  const net = gameState.addServiceIncome(car.id, 1.0);
  assert.equal(net, 0);
  assert.equal(gameState.money, moneyBefore);
  assert.equal(gameState.stats.todayCarsWashed, carsWashedBefore);
});

test('5. Покупка улучшений: проверка баланса и уровней', () => {
  gameState.initNewGame('roadside');
  
  // Улучшение скорости (цена 50 000)
  const res1 = gameState.buyUpgrade('washSpeed');
  assert.equal(res1.success, true);
  assert.equal(res1.newLevel, 1);
  assert.equal(gameState.upgrades.washSpeed, 1);
  assert.equal(gameState.money, 600_000 - 50_000);

  // Искусственно уменьшаем деньги до 0 для проверки запрета покупки
  gameState.money = 0;
  const resFail = gameState.buyUpgrade('washSpeed');
  assert.equal(resFail.success, false);
  assert.equal(resFail.reason, 'Недостаточно средств');
});

test('6. Завершение смены и переход к следующему дню', () => {
  gameState.initNewGame('roadside');
  assert.equal(gameState.day, 1);

  gameState.nextDay();
  assert.equal(gameState.day, 2);
  assert.equal(gameState.stats.todayCarsWashed, 0);
  assert.equal(gameState.stats.todayRevenue, 0);
});

test('7. Сюжетные флаги (однократное срабатывание)', () => {
  gameState.initNewGame('roadside');
  const first = gameState.setStoryFlag('test_flag');
  assert.equal(first, true);

  const second = gameState.setStoryFlag('test_flag');
  assert.equal(second, false);
  assert.equal(gameState.hasStoryFlag('test_flag'), true);
});

test('8. Сериализация и восстановление (Save / Restore)', () => {
  gameState.initNewGame('business');
  gameState.buyUpgrade('capacity');
  gameState.changeReputation(15);
  gameState.setServicePrice(650);

  const snapshot = gameState.serialize();
  assert.equal(snapshot.saveVersion, 3);
  assert.equal(snapshot.location, 'business');
  assert.equal(snapshot.servicePrice, 650);

  // Сброс и восстановление
  gameState.reset();
  assert.equal(gameState.initialized, false);

  const ok = gameState.deserialize(snapshot);
  assert.equal(ok, true);
  assert.equal(gameState.initialized, true);
  assert.equal(gameState.location, 'business');
  assert.equal(gameState.servicePrice, 650);
  assert.equal(gameState.upgrades.capacity, 1);
  assert.equal(gameState.reputation, 65);
});

test('9. Обработка повреждённого сохранения', () => {
  const corrupt1 = null;
  const corrupt2 = { foo: 'bar' };
  const corrupt3 = { saveVersion: 3 }; // no initialized flag

  assert.equal(gameState.deserialize(corrupt1), false);
  assert.equal(gameState.deserialize(corrupt2), false);
  assert.equal(gameState.deserialize(corrupt3), false);
});
