/**
 * StorySystem — сюжетные события, конкурент, решения.
 * Каждое событие срабатывает один раз (через storyFlags).
 */
import gameState from './GameState.js';
import BALANCE from '../config/balance.js';
import { showDialog } from '../../ui/DialogUI.js';
import { showToast } from '../../ui/ToastUI.js';

export class StorySystem {
  constructor() {
    this._events = [
      {
        id: 'day1_intro',
        day: 1,
        flag: 'day1_intro',
        handler: (scene) => {
          showDialog({
            speaker: 'Внутренний голос',
            text: 'Вот и свершилось! Пять лет копил — и наконец моя автомойка открыта. Осталось 600 000 ₽ — нужно быть осторожным с расходами. Время принимать первых клиентов!',
            choices: [{ text: 'Приступить к работе', action: () => {} }],
          });
        },
      },
      {
        id: 'day2_tips',
        day: 2,
        flag: 'day2_tips',
        handler: (scene) => {
          showDialog({
            speaker: 'Внутренний голос',
            text: 'Второй день работы. Можно попробовать нанять работника, чтобы обслуживать больше клиентов. Или вложиться в улучшения оборудования.',
            choices: [{ text: 'Понятно', action: () => {} }],
          });
        },
      },
      {
        id: 'day3_growing',
        day: 3,
        flag: 'day3_growing',
        handler: (scene) => {
          showDialog({
            speaker: 'Внутренний голос',
            text: 'Бизнес набирает обороты. Клиенты приходят, расходы контролируемы. Надо продолжать в том же духе!',
            choices: [{ text: 'Отлично!', action: () => {} }],
          });
        },
      },
      {
        id: 'competitor_appears',
        day: BALANCE.competitor.appearDay,
        flag: 'competitor_appears',
        handler: (scene) => {
          gameState.competitorActive = true;
          showDialog({
            speaker: 'Новости района',
            text: 'Крупная сеть автомоек "КлинАвто" (47 филиалов по стране) открывает точку в 500 метрах от вас! Возможна ценовая война. Подготовьтесь.',
            choices: [
              { text: 'Буду бороться!', action: () => {
                showToast('Конкурент появился рядом', 'warning');
              }},
            ],
          });
        },
      },
      {
        id: 'price_war_start',
        day: BALANCE.competitor.priceWarDay,
        flag: 'price_war_start',
        handler: (scene) => {
          gameState.competitorPriceWar = true;
          showDialog({
            speaker: 'Новости района',
            text: `"КлинАвто" запустила акцию — мойка за ${BALANCE.competitor.priceWarPrice} ₽! Ваш поток клиентов заметно уменьшился. Нужно решить: снижать цены, повышать качество или запускать маркетинг.`,
            choices: [
              { text: 'Изучу варианты', action: () => {
                showToast('Ценовая война началась! Откройте управление бизнесом.', 'warning');
              }},
            ],
          });
        },
      },
      {
        id: 'buyout_offer',
        day: BALANCE.competitor.buyoutOfferDay,
        flag: 'buyout_offer',
        handler: (scene) => {
          gameState.buyoutOffered = true;
          showDialog({
            speaker: 'Региональный директор "КлинАвто"',
            text: `Мы видим, что вы стойко держитесь. Предлагаем выкупить ваш бизнес за ${BALANCE.competitor.buyoutPrice.toLocaleString('ru-RU')} ₽. Это справедливое предложение. Что скажете?`,
            choices: [
              {
                text: `Продать за ${BALANCE.competitor.buyoutPrice.toLocaleString('ru-RU')} ₽`,
                action: () => {
                  gameState.buyoutAccepted = true;
                  gameState.money += BALANCE.competitor.buyoutPrice;
                  gameState._logFinance('income', 'Продажа бизнеса', BALANCE.competitor.buyoutPrice);
                  showDialog({
                    speaker: 'Эпилог',
                    text: `Вы продали бизнес за ${BALANCE.competitor.buyoutPrice.toLocaleString('ru-RU')} ₽. Итоговый баланс: ${gameState.money.toLocaleString('ru-RU')} ₽. Может быть, стоило побороться дальше?`,
                    choices: [{ text: 'Начать заново', action: () => {
                      scene.scene.start('MenuScene');
                    }}],
                  });
                },
              },
              {
                text: 'Отказаться — буду бороться!',
                action: () => {
                  gameState.setStoryFlag('buyout_rejected');
                  showToast('Вы отказались от предложения! Конкуренция продолжается.', 'success');
                  // Ценовая война ослабевает после отказа
                  // Конкурент понимает, что вы серьёзны
                },
              },
            ],
          });
        },
      },
      {
        id: 'competitor_weakens',
        day: BALANCE.competitor.buyoutOfferDay + 3,
        flag: 'competitor_weakens',
        condition: () => gameState.hasStoryFlag('buyout_rejected') && gameState.reputation >= 60,
        handler: (scene) => {
          gameState.competitorPriceWar = false;
          showDialog({
            speaker: 'Новости района',
            text: '"КлинАвто" прекратила демпинг — акция оказалась убыточной. Ваша стойкость и качество окупились! Поток клиентов восстанавливается.',
            choices: [{ text: 'Победа!', action: () => {
              showToast('Конкурент отступил!', 'success');
              gameState.changeReputation(10);
            }}],
          });
        },
      },
    ];
  }

  checkEvents(scene) {
    for (const event of this._events) {
      if (gameState.day >= event.day && !gameState.hasStoryFlag(event.flag)) {
        // Проверяем доп. условие
        if (event.condition && !event.condition()) continue;
        gameState.setStoryFlag(event.flag);
        event.handler(scene);
        break; // Одно событие за раз
      }
    }
  }
}

export default StorySystem;
