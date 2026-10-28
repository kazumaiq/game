/**
 * LocationSelectUI — интерактивный 4-шаговый мастер открытия автомойки:
 * Экран 1: Концепция и стартовый капитал 6 000 000 ₽
 * Экран 2: Выбор локации (Трасса, Жилой, Деловой с текстовыми параметрами)
 * Экран 3: Выбор оборудования (Б/у, Новое Kärcher, Премиум с дозатором)
 * Экран 4: Смета, опции документов (СЭС, МЧС, Экология, Водоканал) и резерв
 */
import BALANCE from '../game/config/balance.js';

let _element = null;

export function showLocationSelect({ locations, startupCosts, totalStartupCost, startingCapital, onSelect }) {
  hideLocationSelect();

  const overlay = document.getElementById('ui-overlay');
  const div = document.createElement('div');
  div.className = 'onboarding-screen';
  div.id = 'onboarding-screen';

  let currentStep = 1;
  let selectedLocationId = 'roadside';
  let selectedEquipment = 'used';
  const selectedDocs = {
    ses: true,
    fire: true,
    ecology: false,
    vodokanal: false,
  };

  const renderStep = () => {
    if (currentStep === 1) {
      // ШАГ 1: Введение
      div.innerHTML = `
        <div class="onboarding-card">
          <div class="step-indicator">ЭТАП 1 ИЗ 4</div>
          <h1 class="onboarding-title">АВТОМОЙКА</h1>
          <div class="onboarding-subtitle">Бизнес на грани</div>
          
          <div class="story-box">
            <p>Пять лет ты копил средства, чтобы запустить собственную автомойку на 2 поста. Теперь у тебя на руках реальный капитал:</p>
            <div class="capital-banner">
              <span class="capital-label">Твой капитал:</span>
              <span class="capital-value">${startingCapital.toLocaleString('ru-RU')} ₽</span>
            </div>
            <p class="story-note">Тебе предстоит выбрать локацию, оснащение и оформить обязательные разрешения, сохранив финансовую подушку безопасности.</p>
          </div>

          <button class="game-btn primary onboarding-btn" id="btn-next-step">Начать планирование ❯</button>
        </div>
      `;
      div.querySelector('#btn-next-step').addEventListener('click', () => {
        currentStep = 2;
        renderStep();
      });
    } else if (currentStep === 2) {
      // ШАГ 2: Выбор локации
      const locationDetails = {
        roadside: {
          traffic: 'Очень высокий',
          repeat: 'Низкая (транзит)',
          comp: 'Умеренная',
        },
        residential: {
          traffic: 'Средний',
          repeat: 'Высокая (соседи)',
          comp: 'Слабая',
        },
        business: {
          traffic: 'Плотный в будни',
          repeat: 'Средняя (офисы)',
          comp: 'Высокая',
        },
      };

      const cardsHtml = Object.values(locations).map(loc => {
        const meta = locationDetails[loc.id] || {};
        const isSelected = loc.id === selectedLocationId;
        return `
          <div class="location-choice-card ${isSelected ? 'selected' : ''}" data-loc="${loc.id}">
            <div class="loc-header">
              <span class="loc-name">${loc.name}</span>
              <span class="loc-rent">${loc.monthlyRent.toLocaleString('ru-RU')} ₽/мес</span>
            </div>
            <div class="loc-indicators">
              <span>Трафик: <strong>${meta.traffic}</strong></span>
              <span>Постоянные: <strong>${meta.repeat}</strong></span>
              <span>Конкуренция: <strong>${meta.comp}</strong></span>
            </div>
            <div class="loc-desc">${loc.description}</div>
          </div>
        `;
      }).join('');

      div.innerHTML = `
        <div class="onboarding-card">
          <div class="step-indicator">ЭТАП 2 ИЗ 4</div>
          <h2 class="card-header">Выбор локации</h2>
          <p class="card-desc">Локация определяет арендную плату, плотность потока и состав клиентов.</p>
          
          <div class="location-choices-grid">
            ${cardsHtml}
          </div>

          <div class="button-row">
            <button class="game-btn" id="btn-prev-step">❮ Назад</button>
            <button class="game-btn primary onboarding-btn" id="btn-next-step">К оборудованию ❯</button>
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
      // ШАГ 3: Выбор оборудования
      const equipOptions = BALANCE.equipmentOptions;
      const equipCards = Object.values(equipOptions).map(opt => {
        const isSelected = opt.id === selectedEquipment;
        return `
          <div class="location-choice-card ${isSelected ? 'selected' : ''}" data-equip="${opt.id}">
            <div class="loc-header">
              <span class="loc-name">${opt.name}</span>
              <span class="loc-rent">${opt.cost.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div class="loc-desc">${opt.description}</div>
          </div>
        `;
      }).join('');

      div.innerHTML = `
        <div class="onboarding-card">
          <div class="step-indicator">ЭТАП 3 ИЗ 4</div>
          <h2 class="card-header">Оснащение постов</h2>
          <p class="card-desc">От качества помп и пистолетов зависит скорость мойки и частота поломок.</p>
          
          <div class="location-choices-grid">
            ${equipCards}
          </div>

          <div class="button-row">
            <button class="game-btn" id="btn-prev-step">❮ Назад</button>
            <button class="game-btn primary onboarding-btn" id="btn-next-step">К смете и лицензиям ❯</button>
          </div>
        </div>
      `;

      div.querySelectorAll('[data-equip]').forEach(card => {
        card.addEventListener('click', () => {
          div.querySelectorAll('[data-equip]').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          selectedEquipment = card.dataset.equip;
        });
      });

      div.querySelector('#btn-prev-step').addEventListener('click', () => {
        currentStep = 2;
        renderStep();
      });

      div.querySelector('#btn-next-step').addEventListener('click', () => {
        currentStep = 4;
        renderStep();
      });
    } else if (currentStep === 4) {
      // ШАГ 4: Смета, разрешения и финансовый резерв
      const equipCost = BALANCE.equipmentOptions[selectedEquipment].cost;
      const baseFixed = BALANCE.startupCosts.deposit +
        BALANCE.startupCosts.permits +
        BALANCE.startupCosts.construction +
        BALANCE.startupCosts.utilities +
        BALANCE.startupCosts.supplies +
        BALANCE.startupCosts.signage;

      let docsCost = 0;
      for (const [k, v] of Object.entries(selectedDocs)) {
        if (v && BALANCE.documents[k]) docsCost += BALANCE.documents[k].cost;
      }

      const totalSpent = baseFixed + equipCost + docsCost;
      const remainingReserve = startingCapital - totalSpent;

      // Чекбоксы документов
      const docsHtml = Object.values(BALANCE.documents).map(doc => {
        const isChecked = selectedDocs[doc.id];
        return `
          <label class="doc-checkbox-row">
            <input type="checkbox" data-doc-toggle="${doc.id}" ${isChecked ? 'checked' : ''} />
            <div class="doc-info-col">
              <div class="doc-name-price">
                <span>${doc.name}</span>
                <span class="price">+${doc.cost.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div class="doc-desc">${doc.description} (Штраф при проверке: ${doc.fine.toLocaleString('ru-RU')} ₽)</div>
            </div>
          </label>
        `;
      }).join('');

      div.innerHTML = `
        <div class="onboarding-card">
          <div class="step-indicator">ЭТАП 4 ИЗ 4</div>
          <h2 class="card-header">Смета и разрешения</h2>

          <div class="budget-summary-box">
            <div class="budget-row">
              <span class="label">Стартовый капитал:</span>
              <span class="val positive">${startingCapital.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div class="budget-row">
              <span class="label">Подготовка и запуск:</span>
              <span class="val negative">−${(baseFixed + equipCost).toLocaleString('ru-RU')} ₽</span>
            </div>
            <div class="budget-row">
              <span class="label">Документы и надзор:</span>
              <span class="val negative">−${docsCost.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div class="budget-row total">
              <span class="label">Остаток резерва:</span>
              <span class="val ${remainingReserve < 0 ? 'negative' : 'highlight'}">${remainingReserve.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>

          <div class="documents-selection-box">
            <div style="font-weight:700;color:#38bdf8;font-size:12px;margin-bottom:6px;text-align:left;">
              Оформить документы сразу:
            </div>
            ${docsHtml}
          </div>

          <div class="reserve-warning-box">
            🛡️ <strong>Сформированный резерв (${remainingReserve.toLocaleString('ru-RU')} ₽)</strong> пойдет на ежедневную аренду, коммунальные платежи и закупку автохимии до выхода на чистую прибыль.
          </div>

          <div class="button-row">
            <button class="game-btn" id="btn-prev-step">❮ Назад</button>
            <button class="game-btn primary onboarding-btn" id="btn-finish-open" ${remainingReserve < 0 ? 'disabled' : ''}>
              Открыть автомойку 🚀
            </button>
          </div>
        </div>
      `;

      div.querySelectorAll('[data-doc-toggle]').forEach(chk => {
        chk.addEventListener('change', () => {
          selectedDocs[chk.dataset.docToggle] = chk.checked;
          renderStep();
        });
      });

      div.querySelector('#btn-prev-step').addEventListener('click', () => {
        currentStep = 3;
        renderStep();
      });

      div.querySelector('#btn-finish-open').addEventListener('click', () => {
        hideLocationSelect();
        onSelect(selectedLocationId, {
          equipment: selectedEquipment,
          docs: selectedDocs,
        });
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
