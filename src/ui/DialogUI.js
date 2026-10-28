/**
 * DialogUI — диалоговые окна с выбором.
 */

let _dialogElement = null;

export function showDialog({ speaker, text, choices }) {
  hideDialog();

  const overlay = document.getElementById('ui-overlay');
  const div = document.createElement('div');
  div.className = 'dialog-box';
  div.id = 'dialog-box';

  let choicesHtml = '';
  if (choices && choices.length > 0) {
    choicesHtml = '<div class="dialog-choices">';
    choices.forEach((choice, idx) => {
      choicesHtml += `<button class="game-btn" data-choice="${idx}">${choice.text}</button>`;
    });
    choicesHtml += '</div>';
  }

  div.innerHTML = `
    <div class="speaker">${speaker || ''}</div>
    <div class="text">${text}</div>
    ${choicesHtml}
  `;

  overlay.appendChild(div);
  _dialogElement = div;

  // Обработчики кнопок
  const buttons = div.querySelectorAll('[data-choice]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
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
  const existing = document.getElementById('dialog-box');
  if (existing) existing.remove();
}
