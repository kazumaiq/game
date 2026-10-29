/**
 * DailyContractsUI — ежедневные контракты с отслеживанием прогресса и наградами.
 */
import gameState from '../game/systems/GameState.js';
import { showToast } from './ToastUI.js';
import { audioManager } from '../game/systems/AudioManager.js';
import saveSystem from '../game/systems/SaveSystem.js';

let cleanupActivePanel = null;

function fmtMoney(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('ru-RU')} ₽`;
}

function progressLabel(contract) {
  const current = Math.min(contract.progress, contract.target);
  if (contract.id === 'revenue') return `${fmtMoney(current)} / ${fmtMoney(contract.target)}`;
  return `${current} / ${contract.target}`;
}

export function showDailyContractsPanel() {
  if (cleanupActivePanel) {
    cleanupActivePanel();
    return;
  }

  const host = document.getElementById('ui-overlay');
  if (!host) return;

  const contracts = gameState.getDailyContracts();
  const overlay = document.createElement('div');
  overlay.className = 'panel-overlay daily-contracts-overlay';
  overlay.id = 'daily-contracts-overlay';

  const icons = { wash: '🚘', revenue: '₽', quality: '✦' };
  overlay.innerHTML = `
    <section class="panel daily-contracts-panel" role="dialog" aria-modal="true" aria-label="Контракты дня">
      <div class="daily-contracts-header">
        <div>
          <div class="daily-contracts-kicker">ДЕНЬ ${gameState.day} · ДОПОЛНИТЕЛЬНЫЙ ЗАРАБОТОК</div>
          <h2>Контракты дня</h2>
        </div>
        <button class="panel-close" id="daily-contracts-close" aria-label="Закрыть окно">✕</button>
      </div>
      <p class="daily-contracts-intro">Выполняй задачи во время смены и забирай бонусы. Награды нужно получить до перехода на следующий день.</p>
      <div class="daily-contract-list">
        ${contracts.map(contract => `
          <article class="daily-contract-card" data-contract-card="${contract.id}">
            <div class="daily-contract-top">
              <span class="daily-contract-icon" aria-hidden="true">${icons[contract.id] || '★'}</span>
              <div class="daily-contract-title-wrap">
                <h3 data-contract-title>${contract.title}</h3>
                <p data-contract-description>${contract.description}</p>
              </div>
              <span class="daily-contract-status" data-contract-status>В работе</span>
            </div>
            <div class="daily-contract-meta">
              <span data-contract-progress>0 / ${contract.target}</span>
              <strong data-contract-reward>+${fmtMoney(contract.reward)}</strong>
            </div>
            <div class="daily-contract-track" aria-hidden="true"><span data-contract-fill></span></div>
            <button class="game-btn" data-contract-claim="${contract.id}" disabled>Выполняется</button>
          </article>
        `).join('')}
      </div>
      <div class="daily-contracts-summary">
        <span>Цели смены</span>
        <strong id="daily-contracts-summary">0 из 3 выполнено</strong>
      </div>
      <div class="daily-contracts-bonus" id="daily-contracts-bonus">
        <span class="daily-contracts-bonus-icon">✦</span>
        <div><strong>Бонус за все контракты</strong><p>Забери все 3 награды и получи дополнительную премию 15 000 ₽.</p></div>
        <strong class="daily-contracts-bonus-value">+15 000 ₽</strong>
      </div>
    </section>
  `;

  host.appendChild(overlay);

  let active = true;
  const refresh = () => {
    if (!active) return;
    const currentContracts = gameState.getDailyContracts();
    let completedCount = 0;
    let claimedCount = 0;

    for (const contract of currentContracts) {
      const card = overlay.querySelector(`[data-contract-card="${contract.id}"]`);
      if (!card) continue;

      const progress = Math.min(contract.progress, contract.target);
      const percent = contract.target > 0 ? Math.round((progress / contract.target) * 100) : 0;
      const description = card.querySelector('[data-contract-description]');
      const progressEl = card.querySelector('[data-contract-progress]');
      const rewardEl = card.querySelector('[data-contract-reward]');
      const fill = card.querySelector('[data-contract-fill]');
      const button = card.querySelector('[data-contract-claim]');
      const status = card.querySelector('[data-contract-status]');

      if (description) description.textContent = contract.description;
      if (progressEl) progressEl.textContent = progressLabel(contract);
      if (rewardEl) rewardEl.textContent = `+${fmtMoney(contract.reward)}`;
      if (fill) fill.style.width = `${percent}%`;
      if (button) {
        button.disabled = !contract.claimable;
        button.textContent = contract.claimed
          ? '✓ Награда получена'
          : contract.claimable
            ? `Забрать ${fmtMoney(contract.reward)}`
            : 'Выполняется';
        button.classList.toggle('primary', contract.claimable);
      }
      if (status) {
        status.textContent = contract.claimed ? 'ЗАБРАНО' : contract.completed ? 'ГОТОВО' : 'В РАБОТЕ';
        status.classList.toggle('is-done', contract.completed);
        status.classList.toggle('is-claimed', contract.claimed);
      }
      card.classList.toggle('is-complete', contract.completed);
      card.classList.toggle('is-claimed', contract.claimed);
      if (contract.completed) completedCount++;
      if (contract.claimed) claimedCount++;
    }

    const summary = overlay.querySelector('#daily-contracts-summary');
    if (summary) summary.textContent = `${completedCount} из 3 выполнено · ${claimedCount} наград получено`;
    const bonus = overlay.querySelector('#daily-contracts-bonus');
    if (bonus) {
      const allClaimed = currentContracts.length === 3 && currentContracts.every(contract => contract.claimed);
      bonus.classList.toggle('is-unlocked', allClaimed);
      const description = bonus.querySelector('p');
      if (description) description.textContent = allClaimed ? 'Бонус получен! Отличная смена.' : `Забери все 3 награды: осталось ${3 - claimedCount}.`;
      const value = bonus.querySelector('.daily-contracts-bonus-value');
      if (value) value.textContent = allClaimed ? '✓ ПОЛУЧЕНО' : '+15 000 ₽';
    }
  };

  const close = () => {
    if (!active) return;
    active = false;
    gameState.off('stateChanged', refresh);
    gameState.off('newDay', refresh);
    overlay.remove();
    if (cleanupActivePanel === close) cleanupActivePanel = null;
  };

  overlay.querySelector('#daily-contracts-close')?.addEventListener('click', () => {
    audioManager.play('buttonClick');
    close();
  });

  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      close();
      return;
    }

    const button = event.target.closest('[data-contract-claim]');
    if (!button || button.disabled) return;

    audioManager.play('buttonClick');
    const result = gameState.claimDailyContract(button.dataset.contractClaim);
    if (result.success) {
      audioManager.play('success');
      saveSystem.save();
      showToast(result.bonus ? `Контракт «${result.title}» выполнен! +${fmtMoney(result.reward)} и бонус +${fmtMoney(result.bonus)} за все цели.` : `Контракт «${result.title}» выполнен: +${fmtMoney(result.reward)}`, 'success');
    } else {
      showToast(result.reason, 'info');
    }
    refresh();
  });

  cleanupActivePanel = close;
  gameState.on('stateChanged', refresh);
  gameState.on('newDay', refresh);
  refresh();
}
