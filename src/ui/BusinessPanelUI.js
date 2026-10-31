/**
 * BusinessPanelUI — панель управления бизнесом.
 * Вкладки: Экономика / Лицензии и безопасность / Персонал / Маркетинг
 */
import gameState from '../game/systems/GameState.js';
import BALANCE from '../game/config/balance.js';
import { showToast } from './ToastUI.js';
import { updateHUD } from './HudUI.js';
import { audioManager } from '../game/systems/AudioManager.js';

function fmt(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '0 ₽';
  return n.toLocaleString('ru-RU') + ' ₽';
}

export function showBusinessPanel() {
  const existing = document.querySelector('#business-panel-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.getElementById('ui-overlay');
  const panel = document.createElement('div');
  panel.className = 'panel-overlay';
  panel.id = 'business-panel-overlay';

  const loc = gameState.getLocation();
  const locName = loc ? loc.name : '—';
  const dailyRent = loc ? loc.dailyRent : 0;
  const businessHealth = gameState.getBusinessHealth();
  const healthLabel = businessHealth.health === 'critical' ? 'КРИТИЧНО' : businessHealth.health === 'warning' ? 'НУЖЕН РЕЗЕРВ' : 'СТАБИЛЬНО';
  const healthColor = businessHealth.health === 'critical' ? '#fb7185' : businessHealth.health === 'warning' ? '#fbbf24' : '#4ade9b';

  // Раздел документов
  let docsHtml = '';
  for (const doc of Object.values(BALANCE.documents)) {
    const isObtained = !!gameState.documents[doc.id];
    docsHtml += `
      <div class="doc-card ${isObtained ? 'obtained' : 'missing'}">
        <div class="doc-main">
          <div class="doc-title">${doc.name}</div>
          <div class="doc-status ${isObtained ? 'ok' : 'alert'}">
            ${isObtained ? '✓ Оформлен и действует' : `⚠ Не оформлен (Штраф: ${fmt(doc.fine)})`}
          </div>
        </div>
        ${isObtained 
          ? '<span class="doc-badge-ok">В ПОРЯДКЕ</span>'
          : `<button class="game-btn primary" data-buy-doc="${doc.id}">Оформить (${fmt(doc.cost)})</button>`
        }
      </div>
    `;
  }

  // Сотрудники
  let empHtml = '';
  for (const emp of gameState.employees) {
    const busy = emp.status === 'working' || emp.status === 'repairing';
    const statusText = emp.status === 'working' ? 'Моет автомобиль' : emp.status === 'repairing' ? 'Обслуживает оборудование' : 'Свободен · готов к работе';
    const statusClass = busy ? 'working' : '';
    const speed = Math.round((Number(emp.speed) || 0) * 100);
    const quality = Math.round((Number(emp.quality) || 0) * 100);
    empHtml += `
      <div class="employee-card">
        <div class="employee-info">
          <div class="name">${emp.name}</div>
          <div class="status ${statusClass}">${statusText}</div>
          <div style="font-size:11px;color:#94a3b8;">Скорость ${speed}% · Качество ${quality}%</div>
          <div style="font-size:11px;color:#94a3b8;">Зарплата: ${fmt(BALANCE.employee.dailySalary)}/день</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
            <button class="game-btn" data-train-emp="${emp.id}" data-skill="speed" ${busy || speed >= 100 || gameState.money < 20000 ? 'disabled' : ''}>⚡ Скорость · 20 000 ₽</button>
            <button class="game-btn" data-train-emp="${emp.id}" data-skill="quality" ${busy || quality >= 100 || gameState.money < 15000 ? 'disabled' : ''}>✦ Качество · 15 000 ₽</button>
          </div>
        </div>
        <button class="game-btn danger" data-fire-emp="${emp.id}" style="font-size:11px;padding:4px 8px;" ${busy ? 'disabled' : ''}>Уволить</button>
      </div>
    `;
  }

  const canHire = gameState.employees.length < BALANCE.employee.maxEmployees;

  // Финансовый лог
  const recentLogs = gameState.financialLog.slice(-10).reverse();
  let logRows = '';
  for (const log of recentLogs) {
    const cls = log.type === 'income' ? 'income' : 'expense';
    const sign = log.type === 'income' ? '+' : '-';
    logRows += `<tr class="${cls}"><td>День ${log.day}: ${log.description}</td><td>${sign}${fmt(log.amount)}</td></tr>`;
  }

  panel.innerHTML = `
    <div class="panel" style="max-width:580px;">
      <button class="panel-close" id="business-close">✕</button>
      <h2>Управление бизнесом</h2>

      <section class="business-health-card" aria-label="Состояние бизнеса">
        <div class="business-health-heading"><div><span>ОПЕРАЦИОННАЯ СВОДКА</span><strong>Здоровье бизнеса</strong></div><b style="color:${healthColor}">${healthLabel}</b></div>
        <div class="business-health-grid">
          <div><span>Расходы / день</span><strong>${fmt(businessHealth.dailyFixed)}</strong></div>
          <div><span>Моек до нуля</span><strong>${businessHealth.washesToBreakEven ?? "—"}</strong></div>
          <div><span>Запас дней</span><strong>${businessHealth.moneyRunwayDays ?? "—"}</strong></div>
          <div><span>Боксы заняты</span><strong>${Math.round(businessHealth.occupancy * 100)}%</strong></div>
        </div>
        <p>${businessHealth.brokenPosts ? `Не работают боксы: ${businessHealth.brokenPosts}.` : "Все открытые боксы доступны для работы."} Следи за тарифом, зарплатами и загрузкой.</p>
      </section>

      <div class="panel-section">
        <h3>Локация и тариф</h3>
        <p style="color:#94a3b8;font-size:12px;">${locName} • Аренда: <strong style="color:#f59e0b;">${fmt(dailyRent)}/день</strong></p>
        <div style="display:flex;align-items:center;gap:10px;margin:8px 0;">
          <button class="game-btn" id="price-down">−50</button>
          <span style="font-size:16px;font-weight:bold;color:#38bdf8;" id="price-display">${fmt(gameState.servicePrice)}</span>
          <button class="game-btn" id="price-up">+50</button>
          <span style="font-size:11px;color:#94a3b8;">за услугу экспресс-мойки</span>
        </div>
      </div>

      <div class="panel-section expansion-section">
        <h3>Расширение автомойки</h3>
        <p style="color:#94a3b8;font-size:12px;margin:0 0 10px;">Открывай новые боксы, чтобы обслуживать больше машин параллельно и быстрее выполнять контракты.</p>
        ${[
          {id:"post_3",title:"Бокс 3 · Экспресс-линия",desc:"Дополнительное место для клиентов и больше пропускной способности.",price:450000},
          {id:"post_4",title:"Бокс 4 · Премиум-линия",desc:"Ещё один рабочий пост для роста выручки. Требует открытый бокс 3.",price:900000}
        ].map(b => {
          const post = gameState.posts.find(p => p.id === b.id);
          const unlocked = post && post.unlocked !== false;
          const canAfford = gameState.money >= b.price && (b.id !== "post_4" || gameState.posts.find(p => p.id === "post_3")?.unlocked !== false);
          return '<article class="expansion-card ' + (unlocked ? "is-unlocked" : "") + '">' +
            '<div class="expansion-copy"><strong>' + b.title + '</strong><span>' + b.desc + '</span><small>' + (unlocked ? "✓ Бокс работает" : "Разовая инвестиция · без ежедневной аренды") + '</small></div>' +
            (unlocked ? '<span class="expansion-status">ОТКРЫТ</span>' : '<button class="game-btn primary" data-unlock-post="' + b.id + '" ' + (canAfford ? "" : "disabled") + '>Открыть · ' + fmt(b.price) + '</button>') +
            '</article>';
        }).join("")}
      </div>

      <div class="panel-section">
        <h3>Техническое обслуживание</h3>
        <p style="color:#94a3b8;font-size:12px;">После каждой мойки оборудование изнашивается. Профилактика стоит 12 000 ₽ и восстанавливает 35 пунктов ресурса. Изношенные боксы чаще ломаются.</p>
        ${gameState.posts.filter(post => post.unlocked !== false).map((post, index) => {
          const condition = Math.max(0, Math.min(100, Math.round(Number.isFinite(post.maintenance) ? post.maintenance : 100)));
          const color = condition < 35 ? '#fb7185' : condition < 65 ? '#fbbf24' : '#4ade9b';
          const label = post.broken ? 'Неисправен · нужен ремонт' : post.busy ? 'Сейчас обслуживает автомобиль' : condition < 35 ? 'Критический износ' : condition < 65 ? 'Нужна профилактика' : 'Рабочее состояние';
          const canService = !post.broken && !post.busy && condition < 100 && gameState.money >= 12000;
          return '<article class="expansion-card">' +
            '<div class="expansion-copy"><strong>Бокс ' + (index + 1) + ' · ' + label + '</strong>' +
            '<div style="height:7px;background:#172538;border-radius:8px;overflow:hidden;margin:8px 0;"><div style="height:100%;width:' + condition + '%;background:' + color + ';border-radius:8px;"></div></div>' +
            '<small>Ресурс оборудования: ' + condition + '%</small></div>' +
            (post.broken ? '<span class="expansion-status">РЕМОНТ</span>' : '<button class="game-btn primary" data-service-post="' + post.id + '" ' + (canService ? '' : 'disabled') + '>Профилактика · 12 000 ₽</button>') +
            '</article>';
        }).join('')}
      </div>
      <div class="panel-section">
        <h3>Документы и проверки надзора</h3>
        <p style="color:#94a3b8;font-size:11px;margin-bottom:8px;">
          Отсутствие документов грозит крупными штрафами во время инспекций СЭС, пожарного надзора и экологии.
        </p>
        ${docsHtml}
      </div>

      <div class="panel-section">
        <h3>Склад автохимии</h3>
        <div class="business-health-grid">
          <div><span>Комплектов на складе</span><strong>${gameState.suppliesStock}</strong></div>
          <div><span>Партия поставки</span><strong>50 шт.</strong></div>
        </div>
        <p style="color:#94a3b8;font-size:12px;">Один комплект расходуется на завершённую мойку. Следи за остатком, чтобы боксы не простаивали.</p>
        <button class="game-btn primary" id="btn-buy-supplies" style="width:100%;" ${gameState.money < 25000 ? "disabled" : ""}>Заказать 50 комплектов · 25 000 ₽</button>
      </div>

      <div class="panel-section">
        <h3>Сотрудники (${gameState.employees.length}/${BALANCE.employee.maxEmployees})</h3>
        ${empHtml}
        ${canHire 
          ? '<button class="game-btn" id="btn-hire" style="margin-top:6px;">Нанять сотрудника (3 000 ₽/день)</button>' 
          : '<p style="color:#94a3b8;font-size:11px;">Штат укомплектован полностью</p>'
        }
      </div>

      <div class="panel-section">
        <h3>Маркетинг и лояльность</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
          ${gameState.marketingActive
            ? `<span style="color:#22c55e;font-size:12px;font-weight:700;">Реклама активна (${gameState.marketingDaysLeft} дн)</span>`
            : `<button class="game-btn" id="btn-marketing">Рекламная кампания (${fmt(BALANCE.marketing.campaignCost)})</button>`
          }
          ${gameState.loyaltyActive
            ? '<span style="color:#22c55e;font-size:12px;font-weight:700;">Программа лояльности подключена</span>'
            : `<button class="game-btn" id="btn-loyalty">Программа лояльности (${fmt(BALANCE.loyalty.setupCost)})</button>`
          }
        </div>
      </div>

      <div class="panel-section">
        <h3>Финансовые операции</h3>
        <table class="finance-table">
          <tr class="income"><td>Выручка за все время</td><td>+${fmt(gameState.stats.totalRevenue)}</td></tr>
          <tr class="expense"><td>Расходы за все время</td><td>-${fmt(gameState.stats.totalExpenses)}</td></tr>
          <tr class="total"><td>Текущий баланс</td><td style="color:${gameState.money >= 0 ? '#22c55e' : '#ef4444'}">${fmt(gameState.money)}</td></tr>
        </table>
        <table class="finance-table" style="max-height:160px;overflow-y:auto;display:block;margin-top:8px;">
          ${logRows || '<tr><td colspan="2" style="color:#94a3b8;">Пока нет операций</td></tr>'}
        </table>
      </div>
    </div>
  `;

  overlay.appendChild(panel);

  document.getElementById('business-close').addEventListener('click', () => {
    audioManager.play('buttonClick');
    panel.remove();
  });
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.remove();
  });

  // Профилактика оборудования
  panel.querySelectorAll('[data-service-post]').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = gameState.servicePost(btn.dataset.servicePost);
      if (result.success) {
        audioManager.play('wrenchRepair');
        showToast('Профилактика завершена · ресурс оборудования восстановлен', 'success');
        panel.remove();
        showBusinessPanel();
      } else {
        audioManager.play('error');
        showToast(result.reason, 'warning');
      }
    });
  });

  // Оформление документов
  panel.querySelectorAll('[data-buy-doc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const docId = btn.dataset.buyDoc;
      const res = gameState.buyDocument(docId);
      if (res.success) {
        audioManager.play('cashRegister');
        showToast(`Документ оформлен: ${res.doc.name}`, 'success');
        panel.remove();
        showBusinessPanel();
      } else {
        audioManager.play('error');
        showToast(res.reason, 'warning');
      }
    });
  });

  // Unlock additional wash bays.
  panel.querySelectorAll('[data-unlock-post]').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = gameState.unlockPost(btn.dataset.unlockPost);
      if (result.success) {
        audioManager.play('cashRegister');
        showToast('Новый бокс открыт! Теперь можно обслуживать больше клиентов.', 'success');
        panel.remove();
        showBusinessPanel();
      } else {
        audioManager.play('error');
        showToast(result.reason, 'warning');
      }
    });
  });

  // Цена
  document.getElementById('price-down').addEventListener('click', () => {
    audioManager.play('buttonClick');
    const newPrice = gameState.servicePrice - 50;
    if (gameState.setServicePrice(newPrice)) {
      document.getElementById('price-display').textContent = fmt(gameState.servicePrice);
    }
  });
  document.getElementById('price-up').addEventListener('click', () => {
    audioManager.play('buttonClick');
    const newPrice = gameState.servicePrice + 50;
    if (gameState.setServicePrice(newPrice)) {
      document.getElementById('price-display').textContent = fmt(gameState.servicePrice);
    }
  });

  // Маркетинг
  const marketingBtn = document.getElementById('btn-marketing');
  if (marketingBtn) {
    marketingBtn.addEventListener('click', () => {
      const result = gameState.startMarketing();
      if (result.success) {
        audioManager.play('success');
        showToast('Реклама запущена!', 'success');
        panel.remove();
        showBusinessPanel();
      } else {
        audioManager.play('error');
        showToast(result.reason, 'warning');
      }
    });
  }

  // Лояльность
  const loyaltyBtn = document.getElementById('btn-loyalty');
  if (loyaltyBtn) {
    loyaltyBtn.addEventListener('click', () => {
      const result = gameState.enableLoyalty();
      if (result.success) {
        audioManager.play('success');
        showToast('Программа лояльности подключена!', 'success');
        panel.remove();
        showBusinessPanel();
      } else {
        audioManager.play('error');
        showToast(result.reason, 'warning');
      }
    });
  }

  // Закупка материалов для склада.
  const suppliesBtn = document.getElementById('btn-buy-supplies');
  if (suppliesBtn) {
    suppliesBtn.addEventListener('click', () => {
      const result = gameState.buySuppliesStock();
      if (result.success) {
        audioManager.play('success');
        showToast('Склад пополнен: 50 комплектов', 'success');
        panel.remove();
        showBusinessPanel();
      } else {
        audioManager.play('error');
        showToast(result.reason, 'warning');
      }
    });
  }

  // Найм
  const hireBtn = document.getElementById('btn-hire');
  if (hireBtn) {
    hireBtn.addEventListener('click', () => {
      const result = gameState.hireEmployee();
      if (result.success) {
        audioManager.play('success');
        showToast(`Нанят сотрудник: ${result.employee.name}`, 'success');
        panel.remove();
        showBusinessPanel();
      } else {
        audioManager.play('error');
        showToast(result.reason, 'warning');
      }
    });
  }

  // Обучение сотрудников
  panel.querySelectorAll('[data-train-emp]').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = gameState.trainEmployee(btn.dataset.trainEmp, btn.dataset.skill);
      if (result.success) {
        audioManager.play('success');
        showToast(`${result.employee.name}: навык улучшен`, 'success');
        panel.remove();
        showBusinessPanel();
      } else {
        audioManager.play('error');
        showToast(result.reason, 'warning');
      }
    });
  });

  // Увольнение
  panel.querySelectorAll('[data-fire-emp]').forEach(btn => {
    btn.addEventListener('click', () => {
      audioManager.play('buttonClick');
      const empId = btn.dataset.fireEmp;
      const emp = gameState.employees.find(e => e.id === empId);
      if (emp && confirm(`Уволить сотрудника ${emp.name}?`)) {
        gameState.fireEmployee(empId);
        showToast(`${emp.name} уволен`, 'info');
        panel.remove();
        showBusinessPanel();
      }
    });
  });

  updateHUD();
}
