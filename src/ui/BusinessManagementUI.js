/**
 * Панель развития автомойки: склад, пакеты услуг, оборудование и карта города.
 * Все покупки проходят через GameState, поэтому попадают в финансы и сохранение.
 */
import gameState from '../game/systems/GameState.js';
import { showToast } from './ToastUI.js';

const money = n => `${Number(n || 0).toLocaleString('ru-RU')} ₽`;
const chemistry = [
  { id: 'basic', name: 'Базовый шампунь', desc: '50 применений', price: 25000, stock: 'basic', icon: '🧴' },
  { id: 'proFoam', name: 'PRO-активная пена', desc: '40 применений · для премиум-мойки', price: 42000, stock: 'proFoam', icon: '🫧' },
  { id: 'wheelCleaner', name: 'Очиститель дисков', desc: '35 применений', price: 36000, stock: 'wheelCleaner', icon: '🛞' },
  { id: 'wax', name: 'Жидкий воск', desc: '30 применений', price: 48000, stock: 'wax', icon: '✨' },
  { id: 'ceramic', name: 'Керамическая защита', desc: '15 применений · высокий чек', price: 95000, stock: 'ceramic', icon: '💎' },
  { id: 'interior', name: 'Очиститель салона', desc: '35 применений', price: 32000, stock: 'interior', icon: '🪑' },
];
const packages = [
  { id: 'standard', name: 'Стандарт', price: 'Базовая цена', desc: 'Обычная мойка кузова', icon: '🚿' },
  { id: 'foam', name: 'PRO-пена', price: '+250 ₽', desc: 'Активная пена и усиленная химия', icon: '🫧' },
  { id: 'wax', name: 'Мойка + воск', price: '+450 ₽', desc: 'Блеск и дополнительная защита', icon: '✨' },
  { id: 'interior', name: 'Комплекс с салоном', price: '+700 ₽', desc: 'Кузов и уборка салона', icon: '🚘' },
  { id: 'ceramic', name: 'Керамика PRO', price: '+1 800 ₽', desc: 'Премиальный пакет с высокой себестоимостью', icon: '💎' },
];
const investments = [
  { id: 'waterFilter', name: 'Фильтрация воды', desc: 'Снижение эксплуатационных расходов', cost: 240000, icon: '💧' },
  { id: 'dryer', name: 'Автоматическая сушка', desc: 'Ускоряет обслуживание постов', cost: 380000, icon: '💨' },
  { id: 'chemicalDoser', name: 'Дозатор химии', desc: 'Точнее расход материалов', cost: 290000, icon: '⚙️' },
  { id: 'extraBay', name: 'Дополнительный пост', desc: 'Расширение пропускной способности', cost: 850000, max: 2, icon: '🏗️' },
  { id: 'detailing', name: 'Студия детейлинга', desc: 'Откроет новое направление бизнеса', cost: 1200000, icon: '✨' },
  { id: 'tireService', name: 'Шиномонтаж', desc: 'Сезонный спрос и новые клиенты', cost: 950000, icon: '🛞' },
  { id: 'coffeeShop', name: 'Кофейня', desc: 'Дополнительный сервис для ожидающих', cost: 550000, icon: '☕' },
  { id: 'sto', name: 'СТО: ремонтный бокс', desc: 'Крупная инвестиция в автосервис', cost: 2200000, icon: '🔧' },
];
const plots = [
  { id: 'residential', name: 'Жилой район', desc: 'Постоянные клиенты и умеренная аренда', cost: 1800000, icon: '🏘️' },
  { id: 'business', name: 'Деловой центр', desc: 'Высокий средний чек и конкуренция', cost: 3200000, icon: '🏙️' },
  { id: 'industrial', name: 'Промзона', desc: 'Фургоны, автопарки и корпоративные заказы', cost: 1400000, icon: '🏭' },
];

let root = null;
let activeTab = 'stock';

function card({ icon, name, desc, price, stock, action, disabled = false, badge = '' }) {
  return `<article class="bm-card">
    <div class="bm-card-icon">${icon}</div><div class="bm-card-main">
      <div class="bm-card-title">${name} ${badge ? `<span class="bm-badge">${badge}</span>` : ''}</div>
      <div class="bm-card-desc">${desc}</div>
      ${stock !== undefined ? `<div class="bm-stock">На складе: <b>${stock}</b></div>` : ''}
    </div>
    <button class="bm-buy" data-action="${action}" ${disabled ? 'disabled' : ''}>${price}</button>
  </article>`;
}

function render() {
  if (!root) return;
  const stock = gameState.chemistryStock || {};
  const content = activeTab === 'stock'
    ? chemistry.map(item => card({ icon:item.icon, name:item.name, desc:item.desc, stock:stock[item.stock] || 0, price:money(item.price), action:`chem:${item.id}`, disabled:gameState.money < item.price })).join('')
    : activeTab === 'services'
      ? packages.map(p => card({ icon:p.icon, name:p.name, desc:p.desc, price:gameState.activeServicePackage === p.id ? 'Выбрано ✓' : p.price, action:`package:${p.id}`, disabled:gameState.activeServicePackage === p.id || (p.id !== 'standard' && !(stock[{foam:'proFoam',wax:'wax',interior:'interior',ceramic:'ceramic'}[p.id]] > 0)), badge:gameState.activeServicePackage === p.id ? 'АКТИВЕН' : '' })).join('')
      : activeTab === 'equipment'
        ? investments.map(item => {
            const level = (gameState.businessUpgrades || {})[item.id] || 0;
            const owned = item.max ? level >= item.max : level > 0;
            return card({ icon:item.icon, name:item.name, desc:item.desc, stock:undefined, price:owned ? `Куплено ${level}/${item.max || 1}` : money(item.cost), action:`upgrade:${item.id}`, disabled:owned || gameState.money < item.cost });
          }).join('')
        : `<div class="bm-city-map">
            <div class="bm-map-road bm-map-road-h"></div><div class="bm-map-road bm-map-road-v"></div>
            <div class="bm-map-district district-home"><span>🏘️</span><b>Жилой район</b><small>${gameState.cityPlots?.residential ? 'Участок открыт' : 'Постоянные клиенты'}</small></div>
            <div class="bm-map-district district-center"><span>🏙️</span><b>Деловой центр</b><small>${gameState.cityPlots?.business ? 'Участок открыт' : 'Высокий средний чек'}</small></div>
            <div class="bm-map-district district-industry"><span>🏭</span><b>Промзона</b><small>${gameState.cityPlots?.industrial ? 'Участок открыт' : 'Автопарки и фургоны'}</small></div>
            <div class="bm-map-district district-current"><span>🚿</span><b>Твоя автомойка</b><small>Основной участок</small></div>
          </div>
          <div class="bm-weather-row"><b>Погода на смене</b><div class="bm-weather-buttons">
            <button data-weather="clear" class="${gameState.weather==='clear'?'active':''}">☀️ Ясно</button>
            <button data-weather="rain" class="${gameState.weather==='rain'?'active':''}">🌧 Дождь</button>
            <button data-weather="snow" class="${gameState.weather==='snow'?'active':''}">❄️ Снег</button>
          </div><small>Дождь повышает спрос на 20%, снег - на 35%.</small></div>
          ${plots.map(item => card({ icon:item.icon, name:item.name, desc:item.desc, price:gameState.cityPlots?.[item.id] ? 'Открыт ✓' : money(item.cost), action:`plot:${item.id}`, disabled:!!gameState.cityPlots?.[item.id] || gameState.money < item.cost, badge:gameState.cityPlots?.[item.id] ? 'ДОСТУПЕН' : '' })).join('')}`;

  root.innerHTML = `<div class="bm-backdrop" data-close="1"><section class="bm-panel" role="dialog" aria-modal="true" aria-label="Развитие бизнеса">
    <header class="bm-header"><div><div class="bm-eyebrow">УПРАВЛЕНИЕ · ДЕНЬ ${gameState.day}</div><h2>Развитие бизнеса</h2><div class="bm-balance">Баланс: <b>${money(gameState.money)}</b></div></div><button class="bm-close" data-close="1" aria-label="Закрыть">✕</button></header>
    <nav class="bm-tabs">
      <button data-tab="stock" class="${activeTab==='stock'?'active':''}">📦 Склад</button>
      <button data-tab="services" class="${activeTab==='services'?'active':''}">🚿 Услуги</button>
      <button data-tab="equipment" class="${activeTab==='equipment'?'active':''}">⚙️ Развитие</button>
      <button data-tab="city" class="${activeTab==='city'?'active':''}">🗺️ Карта</button>
    </nav>
    <div class="bm-content">${content}</div>
    <footer class="bm-footer">Покупки учитываются в финансовом журнале и сохраняются вместе с игрой.</footer>
  </section></div>`;
  root.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', e => {
    if (e.target === el || el.classList.contains('bm-close')) closeBusinessManagement();
  }));
  root.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => { activeTab = el.dataset.tab; render(); }));
  root.querySelectorAll('[data-weather]').forEach(el => el.addEventListener('click', () => {
    const result = gameState.setWeather(el.dataset.weather);
    if (result.success) showToast('Погода обновлена', 'info');
    render();
  }));
  root.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', () => {
    const [type, id] = el.dataset.action.split(':');
    let result;
    if (type === 'chem') result = gameState.buyChemistry(id);
    if (type === 'package') result = gameState.setServicePackage(id);
    if (type === 'upgrade') result = gameState.buyBusinessUpgrade(id);
    if (type === 'plot') result = gameState.buyCityPlot(id);
    if (!result?.success) showToast(result?.reason || 'Не удалось выполнить действие', 'error');
    else showToast(type === 'package' ? `Выбран пакет: ${result.package.name}` : 'Покупка успешно оформлена', 'success');
    render();
  }));
}

export function showBusinessManagementPanel(tab = 'stock') {
  closeBusinessManagement();
  activeTab = tab;
  root = document.createElement('div');
  root.id = 'business-management-root';
  document.getElementById('ui-overlay')?.appendChild(root);
  render();
}

export function closeBusinessManagement() {
  root?.remove();
  root = null;
}
