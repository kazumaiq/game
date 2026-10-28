/**
 * BusinessPanelUI — панель управления бизнесом.
 * Цена, сотрудники, маркетинг, лояльность, финансы.
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
  // Убираем существующую
  const existing = document.querySelector('#business-panel-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.getElementById('ui-overlay');
  const panel = document.createElement('div');
  panel.className = 'panel-overlay';
  panel.id = 'business-panel-overlay';

  const loc = gameState.getLocation();
  const locName = loc ? loc.name : '—';
  const dailyRent = loc ? loc.dailyRent : 0;

  // Последние операции
  const recentLogs = gameState.financialLog.slice(-10).reverse();
  let logRows = '';
  for (const log of recentLogs) {
    const cls = log.type === 'income' ? 'income' : 'expense';
    const sign = log.type === 'income' ? '+' : '-';
    logRows += `<tr class="${cls}"><td>День ${log.day}: ${log.description}</td><td>${sign}${fmt(log.amount)}</td></tr>`;
  }

  // Сотрудники
  let empHtml = '';
  for (const emp of gameState.employees) {
    const statusText = emp.status === 'working' ? 'Работает' : 'Свободен';
    const statusClass = emp.status === 'working' ? 'working' : '';
    empHtml += `
      <div class="employee-card">
        <div class="employee-info">
          <div class="name">${emp.name}</div>
          <div class="status ${statusClass}">${statusText}</div>
          <div style="font-size:11px;color:#888;">Зарплата: ${fmt(BALANCE.employee.dailySalary)}/день</div>
        </div>
        <button class="game-btn danger" data-fire-emp="${emp.id}" style="font-size:12px;padding:6px 10px;">Уволить</button>
      </div>
    `;
  }

  const canHire = gameState.employees.length < BALANCE.employee.maxEmployees;

  panel.innerHTML = `
    <div class="panel" style="max-width:650px;">
      <button class="panel-close" id="business-close">✕</button>
      <h2>Управление бизнесом</h2>

      <h3>Локация: ${locName}</h3>
      <p style="color:#aaa;font-size:13px;">Аренда: ${fmt(dailyRent)}/день | ${fmt(loc ? loc.monthlyRent : 0)}/мес</p>

      <h3>Цена услуги</h3>
      <div style="display:flex;align-items:center;gap:10px;margin:8px 0;">
        <button class="game-btn" id="price-down">−50</button>
        <span style="font-size:18px;font-weight:bold;color:#00d2d3;" id="price-display">${fmt(gameState.servicePrice)}</span>
        <button class="game-btn" id="price-up">+50</button>
      </div>
      <p style="color:#888;font-size:11px;">Диапазон: ${fmt(BALANCE.services.expressWash.minPrice)} — ${fmt(BALANCE.services.expressWash.maxPrice)}</p>

      <h3>Маркетинг</h3>
      ${gameState.marketingActive
        ? `<p style="color:#2ed573;">Кампания активна (${gameState.marketingDaysLeft} дней)</p>`
        : `<button class="game-btn" id="btn-marketing">Запустить кампанию (${fmt(BALANCE.marketing.campaignCost)}, ${BALANCE.marketing.campaignDuration} дня)</button>`
      }

      <h3>Программа лояльности</h3>
      ${gameState.loyaltyActive
        ? '<p style="color:#2ed573;">Активна — повторные клиенты приходят чаще</p>'
        : `<button class="game-btn" id="btn-loyalty">Запустить (${fmt(BALANCE.loyalty.setupCost)})</button>`
      }

      <h3>Сотрудники (${gameState.employees.length}/${BALANCE.employee.maxEmployees})</h3>
      ${empHtml}
      ${canHire ? '<button class="game-btn" id="btn-hire" style="margin-top:8px;">Нанять работника</button>' : '<p style="color:#888;">Максимум сотрудников</p>'}

      <h3>Финансовый отчёт</h3>
      <table class="finance-table">
        <tr class="income"><td>Выручка (всего)</td><td>+${fmt(gameState.stats.totalRevenue)}</td></tr>
        <tr class="expense"><td>Расходы (всего)</td><td>-${fmt(gameState.stats.totalExpenses)}</td></tr>
        <tr class="total"><td>Баланс</td><td style="color:${gameState.money >= 0 ? '#2ed573' : '#ff6b6b'}">${fmt(gameState.money)}</td></tr>
      </table>

      <h3>Последние операции</h3>
      <table class="finance-table" style="max-height:200px;overflow-y:auto;display:block;">
        ${logRows || '<tr><td colspan="2" style="color:#888;">Пока нет операций</td></tr>'}
      </table>
    </div>
  `;

  overlay.appendChild(panel);

  // Обработчики
  document.getElementById('business-close').addEventListener('click', () => panel.remove());
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.remove();
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
        showToast('Маркетинговая кампания запущена!', 'success');
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
        showToast('Программа лояльности активирована!', 'success');
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
        showToast(`Нанят: ${result.employee.name}`, 'success');
        panel.remove();
        showBusinessPanel();
      } else {
        showToast(result.reason, 'warning');
      }
    });
  }

  // Увольнение
  document.querySelectorAll('[data-fire-emp]').forEach(btn => {
    btn.addEventListener('click', () => {
      const empId = btn.dataset.fireEmp;
      const emp = gameState.employees.find(e => e.id === empId);
      if (emp && confirm(`Уволить ${emp.name}?`)) {
        gameState.fireEmployee(empId);
        showToast(`${emp.name} уволен`, 'info');
        panel.remove();
        showBusinessPanel();
      }
    });
  });

  updateHUD();
}
