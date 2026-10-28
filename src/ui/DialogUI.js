/**
 * DialogUI — диалоговые окна с выбором и управлением очередью окон.
 */

let _dialogElement = null;

export function showDialog({ speaker, text, choices }) {
  hideDialog();

  // При открытии диалога временно скрываем плашку туториала, чтобы они никогда не накладывались
  const tutorialEl = document.getElementById('tutorial-overlay');
  if (tutorialEl) {
    tutorialEl.style.display = 'none';
  }

  const overlay = document.getElementById('ui-overlay');
  const div = document.createElement('div');
  div.className = 'dialog-backdrop';
  div.id = 'dialog-backdrop-layer';

  let choicesHtml = '';
  if (choices && choices.length > 0) {
    choicesHtml = '<div class="dialog-choices">';
    choices.forEach((choice, idx) => {
      choicesHtml += `<button class="game-btn primary" data-choice="${idx}">${choice.text}</button>`;
    });
    choicesHtml += '</div>';
  }

  div.innerHTML = `
    <div class="dialog-box">
      <div class="dialog-badge">${speaker || 'Сообщение'}</div>
      <div class="text">${text}</div>
      ${choicesHtml}
    </div>
  `;

  overlay.appendChild(div);
  _dialogElement = div;

  const buttons = div.querySelectorAll('[data-choice]');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.choice);
      if (choices[idx] && choices[idx].action) {
        choices[idx].action();
      }
      hideDialog();
    });
  });
}

export function hideDialog() {
  if (_dialogElement) {
    _dialogElement.remove();
    _dialogElement = null;
  }
  const existing = document.getElementById('dialog-backdrop-layer');
  if (existing) existing.remove();

  // Восстанавливаем показ туториала
  const tutorialEl = document.getElementById('tutorial-overlay');
  if (tutorialEl) {
    tutorialEl.style.display = 'flex';
  }
}
