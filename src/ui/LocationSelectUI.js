/**
 * LocationSelectUI — 3-шаговый адаптивный процесс онбординга:
 * Экран 1: Открытие бизнеса (Сюжет + капитал 6 000 000 ₽)
 * Экран 2: Выбор локации (3 карточки с плюсами, минусами и спросом)
 * Экран 3: Подготовка к открытию (Компактный бюджет, раскрываемый список, резерв 600 000 ₽)
 */

let _element = null;

export function showLocationSelect({ locations, startupCosts, totalStartupCost, startingCapital, onSelect }) {
  hideLocationSelect();

  const overlay = document.getElementById('ui-overlay');
  const div = document.createElement('div');
  div.className = 'onboarding-screen';
  div.id = 'onboarding-screen';

  let currentStep = 1;
  let selectedLocationId = 'roadside';

  const renderStep = () => {
    if (currentStep === 1) {
      // ЭКРАН 1: Открытие бизнеса
      div.innerHTML = `
        <div class="onboarding-card">
          <div class="step-indicator">ШАГ 1 ИЗ 3</div>
          <h1 class="onboarding-title">АВТОМОЙКА</h1>
          <div class="onboarding-subtitle">Бизнес на грани</div>
          
          <div class="story-box">
            <p>Пять долгих лет упорного труда позволили скопить стартовый капитал. Ты решаешь открыть собственную автомойку и построить успешное дело.</p>
            <div class="capital-banner">
              <span class="capital-label">Твой капитал:</span>
              <span class="capital-value">${startingCapital.toLocaleString('ru-RU')} ₽</span>
            </div>
            <p class="story-note">Но помни: рынок суров, а конкуренты не дремлют. Выбирай стратегию с умом!</p>
          </div>

          <button class="game-btn primary onboarding-btn" id="btn-next-step">Начать историю ❯</button>
        </div>
      `;
      div.querySelector('#btn-next-step').addEventListener('click', () => {
        currentStep = 2;
        renderStep();
      });
    } else if (currentStep === 2) {
      // ЭКРАН 2: Выбор локации
      const locationMeta = {
        roadside: {
          tag: 'У трассы',
          pros: 'Высокий спонтанный трафик машин',
          cons: 'Зависимость от погоды и трафика шоссе',
          demand: '⭐⭐⭐⭐☆ Высокий',
        },
        residential: {
          tag: 'Жилой массив',
          pros: 'Высокая база постоянных клиентов',
          cons: 'Спокойный умеренный поток',
          demand: '⭐⭐⭐☆☆ Стабильный',
        },
        business: {
          tag: 'Деловой район',
          pros: 'Высокий средний чек и премиум-авто',
          cons: 'Высокая аренда и жесткая конкуренция',
          demand: '⭐⭐⭐⭐⭐ Высокий чек',
        },
      };

      const cardsHtml = Object.values(locations).map(loc => {
        const meta = locationMeta[loc.id] || {};
        const isSelected = loc.id === selectedLocationId;
        return `
          <div class="location-choice-card ${isSelected ? 'selected' : ''}" data-loc="${loc.id}">
            <div class="loc-header">
              <span class="loc-name">${loc.name}</span>
              <span class="loc-rent">${loc.monthlyRent.toLocaleString('ru-RU')} ₽/мес</span>
            </div>
            <div class="loc-pros">✓ ${meta.pros || ''}</div>
            <div class="loc-cons">✕ ${meta.cons || ''}</div>
            <div class="loc-demand">Спрос: <strong>${meta.demand || 'Средний'}</strong></div>
          </div>
        `;
      }).join('');

      div.innerHTML = `
        <div class="onboarding-card">
          <div class="step-indicator">ШАГ 2 ИЗ 3</div>
          <h2 class="card-header">Выбор локации</h2>
          <p class="card-desc">Локация определяет поток клиентов, арендную плату и уровень конкуренции.</p>
          
          <div class="location-choices-grid">
            ${cardsHtml}
          </div>

          <div class="button-row">
            <button class="game-btn" id="btn-prev-step">❮ Назад</button>
            <button class="game-btn primary onboarding-btn" id="btn-next-step">Далее ❯</button>
          </div>
        </div>
      `;

      div.querySelectorAll('.location-choice-card').forEach(card => {
        card.addEventListener('click', () => {
          div.querySelectorAll('.location-choice-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          selectedLocationId = card.dataset.loc;
        });
      });

      div.querySelector('#btn-prev-step').addEventListener('click', () => {
        currentStep = 1;
        renderStep();
      });

      div.querySelector('#btn-next-step').addEventListener('click', () => {
        currentStep = 3;
        renderStep();
      });
    } else if (currentStep === 3) {
      // ЭКРАН 3: Подготовка к открытию (Компактная карточка бюджета)
      const remaining = startingCapital - totalStartupCost;
      const names = {
        deposit: 'Залог и аренда (1 мес)',
        permits: 'Разрешения и лицензии',
        construction: 'Строительные работы',
        equipment: '2 комплекта оборудования',
        utilities: 'Подключение коммуникаций',
        supplies: 'Расходная химия',
        signage: 'Вывеска и брендинг',
      };

      const costItemsHtml = Object.entries(startupCosts).map(([key, val]) => `
        <div class="cost-detail-row">
          <span>${names[key] || key}</span>
          <span>${val.toLocaleString('ru-RU')} ₽</span>
        </div>
      `).join('');

      div.innerHTML = `
        <div class="onboarding-card">
          <div class="step-indicator">ШАГ 3 ИЗ 3</div>
          <h2 class="card-header">Смета запуска</h2>
          
          <div class="budget-summary-box">
            <div class="budget-row">
              <span class="label">Стартовый капитал:</span>
              <span class="val positive">${startingCapital.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div class="budget-row">
              <span class="label">Расходы на запуск:</span>
              <span class="val negative">−${totalStartupCost.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div class="budget-row total">
              <span class="label">Остаток на счете:</span>
              <span class="val highlight">${remaining.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>

          <details class="cost-details-accordion">
            <summary class="details-summary">Показать структуру расходов ▼</summary>
            <div class="details-content">
              ${costItemsHtml}
            </div>
          </details>

          <div class="reserve-warning-box">
            ⚠️ <strong>Резерв на счете (600 000 ₽)</strong> необходим для ежедневной аренды, зарплаты сотрудников и покупки моющей химии, пока автомойка не начнет приносить стабильную прибыль.
          </div>

          <div class="button-row">
            <button class="game-btn" id="btn-prev-step">❮ Назад</button>
            <button class="game-btn primary onboarding-btn" id="btn-finish-open">Открыть автомойку 🚀</button>
          </div>
        </div>
      `;

      div.querySelector('#btn-prev-step').addEventListener('click', () => {
        currentStep = 2;
        renderStep();
      });

      div.querySelector('#btn-finish-open').addEventListener('click', () => {
        hideLocationSelect();
        onSelect(selectedLocationId);
      });
    }
  };

  renderStep();
  overlay.appendChild(div);
  _element = div;
}

export function hideLocationSelect() {
  if (_element) {
    _element.remove();
    _element = null;
  }
  const existing = document.getElementById('onboarding-screen');
  if (existing) existing.remove();
}
