/**
 * main.js — точка входа клиентского приложения.
 * Ошибки старта показываем поверх игры, а не оставляем пользователю пустой экран.
 */
import { createGame } from './game/createGame.js';
import { audioManager } from './game/systems/AudioManager.js';

function showStartupError(error, title = 'Не удалось запустить игру') {
  console.error('[CarWash startup]', error);
  let panel = document.getElementById('startup-error-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'startup-error-panel';
    panel.setAttribute('role', 'alert');
    panel.innerHTML = `
      <div class="startup-error-card">
        <div class="startup-error-mark">!</div>
        <h1></h1>
        <p class="startup-error-copy">Игра не смогла загрузить сцену. Попробуй перезапустить её.</p>
        <pre class="startup-error-detail"></pre>
        <button type="button" id="startup-error-retry">Перезапустить игру</button>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#startup-error-retry').addEventListener('click', () => window.location.reload());
  }
  panel.querySelector('h1').textContent = title;
  const detail = error instanceof Error ? error.message : String(error || 'Неизвестная ошибка');
  panel.querySelector('.startup-error-detail').textContent = detail.slice(0, 500);
  panel.hidden = false;
}

window.addEventListener('error', (event) => {
  if (event.error || event.message) showStartupError(event.error || event.message, 'Ошибка выполнения игры');
});
window.addEventListener('unhandledrejection', (event) => {
  showStartupError(event.reason, 'Ошибка загрузки игры');
});

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.__phaserGame = createGame();
    window.__audioManager = audioManager;

    // Проверяем реальный результат запуска, а не только факт создания Phaser.Game.
    window.setTimeout(() => {
      const game = window.__phaserGame;
      const canvas = document.querySelector('#game-container canvas');
      const activeScenes = game?.scene?.getScenes(true) || [];
      if (!canvas || !activeScenes.length) {
        showStartupError(
          new Error(!canvas ? 'Phaser не создал игровой Canvas.' : 'Игровая сцена не перешла в активное состояние.'),
          'Игра не завершила запуск'
        );
      }
    }, 18000);
  } catch (error) {
    showStartupError(error, 'Не удалось создать игровое окно');
  }
});
