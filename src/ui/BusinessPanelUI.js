/**
 * BusinessPanelUI — панель управления бизнесом.
 * Вкладки: Экономика / Лицензии и безопасность / Персонал / Маркетинг
 */
import gameState from '../game/systems/GameState.js';
import BALANCE from '../game/config/balance.js';
import { showToast } from './ToastUI.js';
import { updateHUD } from './HudUI.js';

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
    const statusText = emp.status === 'working' ? 'Работает в боксе' : 'Свободен';
    const statusClass = emp.status === 'working' ? 'working' : '';
    empHtml += `
      <div class="employee-card">
        <div class="employee-info">
          <div class="name">${emp.name}</div>
          <div class="status ${statusClass}">${statusText}</div>
          <div style="font-size:11px;color:#94a3b8;">Зарплата: ${fmt(BALANCE.employee.dailySalary)}/день</div>
        </div>
        <button class="game-btn danger" data-fire-emp="${emp.id}" style="font-size:11px;padding:4px 8px;">Уволить</button>
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

      <div class="panel-section">
        <h3>Документы и проверки надзора</h3>
        <p style="color:#94a3b8;font-size:11px;margin-bottom:8px;">
          Отсутствие документов грозит крупными штрафами во время инспекций СЭС, пожарного надзора и экологии.
        </p>
        ${docsHtml}
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

  document.getElementById('business-close').addEventListener('click', () => panel.remove());
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.remove();
  });

  // Оформление документов
  panel.querySelectorAll('[data-buy-doc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const docId = btn.dataset.buyDoc;
      const res = gameState.buyDocument(docId);
      if (res.success) {
        showToast(`Документ оформлен: ${res.doc.name}`, 'success');
        panel.remove();
        showBusinessPanel();
      } else {
        showToast(res.reason, 'warning');
      }
    });
  });

  // Цена
  document.getElementById('price-down').addEventListener('click', () => {
    const newPrice = gameState.servicePrice - 50;
    if (gameState.setServicePrice(newPrice)) {
      document.getElementById('price-display').textContent = fmt(gameState.servicePrice);
    }
  });
  document.getElementById('price-up').addEventListener('click', () => {
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
        showToast('Реклама запущена!', 'success');
        panel.remove();
        showBusinessPanel();
      } else {
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
        showToast('Программа лояльности подключена!', 'success');
        panel.remove();
        showBusinessPanel();
      } else {
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
        showToast(`Нанят сотрудник: ${result.employee.name}`, 'success');
        panel.remove();
        showBusinessPanel();
      } else {
        showToast(result.reason, 'warning');
      }
    });
  }

  // Увольнение
  panel.querySelectorAll('[data-fire-emp]').forEach(btn => {
    btn.addEventListener('click', () => {
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
