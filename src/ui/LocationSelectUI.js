/**
 * LocationSelectUI — экран выбора локации и финансовой сводки.
 */

let _element = null;

export function showLocationSelect({ locations, startupCosts, totalStartupCost, startingCapital, onSelect }) {
  hideLocationSelect();

  const overlay = document.getElementById('ui-overlay');
  const div = document.createElement('div');
  div.className = 'menu-screen';
  div.id = 'location-select';
  div.style.overflow = 'auto';

  const costRows = Object.entries(startupCosts).map(([key, val]) => {
    const names = {
      deposit: 'Залог и аренда',
      permits: 'Документы и разрешения',
      construction: 'Подготовка территории',
      equipment: 'Оборудование (б/у)',
      utilities: 'Подключения и монтаж',
      supplies: 'Расходные материалы',
      signage: 'Вывеска и открытие',
    };
    return `<tr class="expense"><td>${names[key] || key}</td><td>-${val.toLocaleString('ru-RU')} ₽</td></tr>`;
  }).join('');

  const remaining = startingCapital - totalStartupCost;

  const locationCards = Object.values(locations).map(loc => `
    <div class="location-card" data-loc="${loc.id}">
      <h4>${loc.name}</h4>
      <p class="rent">Аренда: ${loc.monthlyRent.toLocaleString('ru-RU')} ₽/мес</p>
      <p>${loc.description}</p>
    </div>
  `).join('');

  div.innerHTML = `
    <div style="max-width:700px;width:90%;padding:20px;">
      <h2 style="color:#00d2d3;text-align:center;margin-bottom:20px;">Финансовая сводка</h2>
      <table class="finance-table">
        <tr class="income"><td>Накопления</td><td>+${startingCapital.toLocaleString('ru-RU')} ₽</td></tr>
        ${costRows}
        <tr class="total"><td>Остаток</td><td style="color:#2ed573">${remaining.toLocaleString('ru-RU')} ₽</td></tr>
      </table>

      <h2 style="color:#00d2d3;text-align:center;margin:24px 0 16px;">Выберите локацию</h2>
      <div class="location-cards">${locationCards}</div>

      <div style="text-align:center;margin-top:24px;">
        <button class="game-btn primary" id="loc-confirm" disabled>Открыть автомойку</button>
      </div>
    </div>
  `;

  overlay.appendChild(div);
  _element = div;

  let selectedLoc = null;
  const cards = div.querySelectorAll('.location-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedLoc = card.dataset.loc;
      document.getElementById('loc-confirm').disabled = false;
    });
  });

  document.getElementById('loc-confirm').addEventListener('click', () => {
    if (selectedLoc) onSelect(selectedLoc);
  });
}

export function hideLocationSelect() {
  if (_element) {
    _element.remove();
    _element = null;
  }
  const existing = document.getElementById('location-select');
  if (existing) existing.remove();
}
