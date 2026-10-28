/**
 * WashProgressUI — индикатор процесса мойки.
 */

let _element = null;

export function showWashProgress(stageName, progress, instructions) {
  if (!_element) {
    const overlay = document.getElementById('ui-overlay');
    const div = document.createElement('div');
    div.className = 'wash-progress';
    div.id = 'wash-progress';
    div.innerHTML = `
      <div class="stage-name" id="wash-stage-name"></div>
      <div class="progress-bar"><div class="fill" id="wash-progress-fill" style="width:0%"></div></div>
      <div class="instructions" id="wash-instructions"></div>
    `;
    overlay.appendChild(div);
    _element = div;
  }

  document.getElementById('wash-stage-name').textContent = stageName;
  document.getElementById('wash-progress-fill').style.width = progress + '%';
  document.getElementById('wash-instructions').textContent = instructions || '';
}

export function hideWashProgress() {
  if (_element) {
    _element.remove();
    _element = null;
  }
  const existing = document.getElementById('wash-progress');
  if (existing) existing.remove();
}
