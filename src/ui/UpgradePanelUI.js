/**
 * UpgradePanelUI — панель улучшений оборудования и мойки.
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

export function showUpgradePanel() {
  const existing = document.querySelector('#upgrade-panel-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.getElementById('ui-overlay');
  const panel = document.createElement('div');
  panel.className = 'panel-overlay';
  panel.id = 'upgrade-panel-overlay';

  const unlockedBays = gameState.posts.filter(post => post.unlocked !== false).length;
  const dailyRevenue = gameState.stats.todayRevenue || 0;
  const dailyCars = gameState.stats.todayCarsWashed || 0;
  let itemsHtml = '';
  for (const [key, upgrade] of Object.entries(BALANCE.upgrades)) {
    const curLevel = gameState.upgrades[key] || 0;
    const isMax = curLevel >= upgrade.maxLevel;
    const nextPrice = !isMax ? upgrade.prices[curLevel] : null;
    const canAfford = !isMax && gameState.money >= nextPrice;

    itemsHtml += `
      <div class="upgrade-item">
        <div class="upgrade-info">
          <div class="name">${upgrade.name}</div>
          <div class="desc">${upgrade.description}</div>
          <div class="level">Уровень: ${curLevel} / ${upgrade.maxLevel}</div>
          <div class="upgrade-level-track"><span style="width:${Math.round(curLevel / upgrade.maxLevel * 100)}%"></span></div>
        </div>
        <div>
          ${isMax 
            ? '<span style="color:#2ed573;font-weight:bold;font-size:13px;">МАКС</span>' 
            : `<button class="game-btn primary" data-buy-upgrade="${key}" ${canAfford ? '' : 'disabled'}>
                Купить (${fmt(nextPrice)})
               </button>`
          }
        </div>
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="panel" style="max-width:650px;">
      <button class="panel-close" id="upgrade-close">✕</button>
      <h2>Модернизация оборудования</h2>
      <p style="color:#aaa;font-size:13px;margin-bottom:12px;">
        Доступный баланс: <strong style="color:#00d2d3">${fmt(gameState.money)}</strong>
      </p>
      <div class="upgrade-overview">
        <div><span>МОЕЧНЫЕ БОКСЫ</span><strong>${unlockedBays} / ${gameState.posts.length}</strong></div>
        <div><span>АВТО ЗА СМЕНУ</span><strong>${dailyCars}</strong></div>
        <div><span>ВЫРУЧКА СЕГОДНЯ</span><strong>${fmt(dailyRevenue)}</strong></div>
      </div>
      <p class="upgrade-hint">Совет: скорость увеличивает число машин за смену, а надёжность помогает избежать простоев. Новые боксы открываются в разделе «Бизнес».</p>
      <div class="upgrade-list">
        ${itemsHtml}
      </div>
    </div>
  `;

  overlay.appendChild(panel);

  document.getElementById('upgrade-close').addEventListener('click', () => {
    audioManager.play('buttonClick');
    panel.remove();
  });
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.remove();
  });

  panel.querySelectorAll('[data-buy-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.buyUpgrade;
      const res = gameState.buyUpgrade(id);
      if (res.success) {
        audioManager.play('cashRegister');
        showToast(`Улучшение куплено! Новый уровень: ${res.newLevel}`, 'success');
        panel.remove();
        showUpgradePanel();
        updateHUD();
      } else {
        audioManager.play('error');
        showToast(res.reason, 'warning');
      }
    });
  });
}
