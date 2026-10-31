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
          gameState.emit('stateChanged');
          showDialog({
            speaker: 'Новости района',
            text: 'Через дорогу, прямо напротив вашей мойки, открывается новая точка федеральной сети «КлинАвто». У сети 47 автомоек. На открытии сцена, диджей, толпа гостей и очередь из машин. Региональный директор лично наблюдает за запуском. Это уже не просто сосед, а серьёзный конкурент.',
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
          gameState.emit('stateChanged');
          showDialog({
            speaker: 'Новости района',
            text: `«КлинАвто» начинает демпинг: мойка за ${BALANCE.competitor.priceWarPrice} ₽ против ваших ${gameState.servicePrice} ₽. Поток падает примерно с 40 до 3-5 машин за день. Вы вложили почти 6 000 000 ₽, на счету осталось около 600 000 ₽. Директор предлагает выкупить вашу автомойку за 1 200 000 ₽. Придётся выбирать стратегию и держаться.`,
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
        condition: () => gameState.hasStoryFlag('buyout_rejected'),
        handler: (scene) => {
          gameState.competitorPriceWar = false;
          gameState.competitorBrokenBays = 2;
          gameState.competitorClosed = true;
          gameState.competitorPriceWar = false;
          gameState.emit('stateChanged');
          showDialog({
            speaker: 'Новости района',
            text: 'После затяжной ценовой войны у «КлинАвто» выходят из строя два моечных бокса. Ремонт затягивается, расходы сети растут. Поток клиентов постепенно возвращается к вам. Впервые за долгое время директор сети теряет уверенность.',
            choices: [{ text: 'Победа!', action: () => {
              showToast('Конкурент отступил!', 'success');
              gameState.changeReputation(10);
            }}],
          });
        },
      },
      {
        id: 'competitor_final_buyout',
        day: BALANCE.competitor.buyoutOfferDay + 5,
        flag: 'competitor_final_buyout',
        condition: () => gameState.hasStoryFlag('buyout_rejected') && gameState.competitorClosed,
        handler: (scene) => {
          showDialog({
            speaker: 'Региональный директор «КлинАвто»',
            text: 'Мы закрываем эту точку. Выстояли там, где не справилась федеральная сеть. Предлагаю другую сделку: продадим вам оборудование и готовый бизнес этой автомойки за 1 200 000 ₽. Решение за вами.',
            choices: [
              { text: 'Купить точку и оборудование за 1 200 000 ₽', action: () => {
                if (gameState.money < 1_200_000) {
                  showToast('Не хватает 1 200 000 ₽. Предложение появится снова, когда накопите нужную сумму.', 'warning');
                  return;
                }
                gameState.money -= 1_200_000;
                gameState.stats.totalExpenses += 1_200_000;
                gameState.stats.todayExpenses += 1_200_000;
                gameState._logFinance('expense', 'Покупка оборудования «КлинАвто»', 1_200_000);
                gameState.competitorAcquired = true;
                gameState.posts[2].unlocked = true;
                gameState.posts[3].unlocked = true;
                gameState.posts[2].maintenance = 100;
                gameState.posts[3].maintenance = 100;
                gameState.setStoryFlag('competitor_acquired');
                gameState.emit('stateChanged');
                showDialog({
                  speaker: 'Новая глава',
                  text: 'Вы выкупили оборудование и клиентскую базу закрывшейся точки «КлинАвто». Два дополнительных бокса теперь доступны на вашей площадке. Вы расширили автомойку до четырёх постов.',
                  choices: [{ text: 'Продолжить', action: () => showToast('Новая точка добавлена в вашу историю.', 'success') }],
                });
              }},
              { text: 'Пока отказаться', action: () => {
                gameState.setStoryFlag('competitor_buyout_declined');
                showToast('Вы отказались от покупки. Точка остаётся закрытой.', 'info');
              }},
            ],
          });
        },
      },
      {
        id: 'competitor_final_buyout_retry',
        day: BALANCE.competitor.buyoutOfferDay + 6,
        flag: 'competitor_final_buyout_retry',
        condition: () => gameState.hasStoryFlag('buyout_rejected')
          && gameState.competitorClosed
          && !gameState.competitorAcquired
          && !gameState.hasStoryFlag('competitor_buyout_declined')
          && gameState.money >= BALANCE.competitor.buyoutPrice,
        handler: () => {
          showDialog({
            speaker: 'Региональный директор «КлинАвто»',
            text: 'Вы собрали нужную сумму. Предложение о покупке оборудования и клиентской базы всё ещё в силе. Готовы расширить свою автомойку?',
            choices: [
              { text: 'Купить за 1 200 000 ₽', action: () => {
                const price = BALANCE.competitor.buyoutPrice;
                if (gameState.money < price) {
                  showToast('На счету снова недостаточно средств.', 'warning');
                  return;
                }
                gameState.money -= price;
                gameState.stats.totalExpenses += price;
                gameState.todayExpenses += price;
                gameState._logFinance('expense', 'Покупка оборудования «КлинАвто»', price);
                for (const postId of ['post_3', 'post_4']) {
                  const post = gameState.posts.find(item => item.id === postId);
                  if (post) {
                    post.unlocked = true;
                    post.broken = false;
                    post.maintenance = 100;
                  }
                }
                gameState.competitorAcquired = true;
                gameState.setStoryFlag('competitor_acquired');
                gameState.emit('stateChanged');
                showToast('Два дополнительных бокса открыты!', 'success');
              }},
              { text: 'Отказаться', action: () => {
                gameState.setStoryFlag('competitor_buyout_declined');
                showToast('Вы отказались от сделки.', 'info');
              }},
            ],
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
