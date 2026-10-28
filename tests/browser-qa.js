import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.resolve(ROOT_DIR, 'qa-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runBrowserQA() {
  console.log('=== ЗАПУСК BROWSER QA ДЛЯ "АВТОМОЙКА: БИЗНЕС НА ГРАНИ" ===\n');

  // 1. Запуск Vite Dev Server
  console.log('1. Запуск встроенного Vite сервера...');
  const server = await createServer({
    root: ROOT_DIR,
    server: {
      port: 5199,
      strictPort: true,
    },
  });
  await server.listen();
  const serverUrl = `http://localhost:${server.config.server.port}`;
  console.log(`✓ Сервер запущен: ${serverUrl}\n`);

  // 2. Запуск Chrome через Puppeteer
  console.log('2. Запуск Chrome (Headless: new, WebGL & Web Audio enabled)...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
    ],
  });

  const page = await browser.newPage();

  page.on('dialog', async (dialog) => {
    console.log(`[Browser Dialog] ${dialog.type()}: "${dialog.message()}" -> ACCEPT`);
    await dialog.accept();
  });

  const consoleLogs = [];
  const errors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      errors.push(text);
      console.error(`[Console Error]: ${text}`);
    } else if (text.includes('warn')) {
      console.warn(`[Console Warn]: ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.toString());
    console.error(`[Page Error]: ${err.message}`);
  });

  // Эмуляция мобильного устройства (iPhone 14, 390x844, DPR = 2)
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const results = {
    canvasMetrics: null,
    audioState: null,
    flowStepsCompleted: [],
    screenshots: [],
    errors: [],
  };

  try {
    // ШАГ 1: Загрузка страницы
    console.log(`3. Открытие ${serverUrl}...`);
    await page.goto(serverUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));

    // Скриншот 1: Главное меню
    const s1 = path.join(SCREENSHOT_DIR, '01_main_menu.png');
    await page.screenshot({ path: s1 });
    results.screenshots.push({ name: 'Главное меню', path: s1 });
    console.log('✓ Скриншот 1 сохранен: 01_main_menu.png');
    results.flowStepsCompleted.push('Главное меню открыто');

    // Canvas Metrics
    results.canvasMetrics = await page.evaluate(() => {
      const canvas = document.querySelector('#game-container canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        rectWidth: rect.width,
        rectHeight: rect.height,
        internalWidth: canvas.width,
        internalHeight: canvas.height,
        dpr: window.devicePixelRatio,
        computedImageRendering: getComputedStyle(canvas).imageRendering,
      };
    });

    // ШАГ 2: Переход к онбордингу
    console.log('4. Переход к выбору локации и стартовой конфигурации...');
    const newGameBtn = await page.$('#menu-new-game');
    if (newGameBtn) await newGameBtn.click();
    await new Promise((r) => setTimeout(r, 800));

    const s2 = path.join(SCREENSHOT_DIR, '02_onboarding_step1.png');
    await page.screenshot({ path: s2 });
    results.screenshots.push({ name: 'Онбординг: Шаг 1', path: s2 });
    console.log('✓ Скриншот 2 сохранен: 02_onboarding_step1.png');

    for (let step = 1; step <= 3; step++) {
      const nextBtn = await page.$('#btn-next-step');
      if (nextBtn) {
        await nextBtn.click();
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const s3 = path.join(SCREENSHOT_DIR, '03_onboarding_estimate.png');
    await page.screenshot({ path: s3 });
    results.screenshots.push({ name: 'Онбординг: Смета', path: s3 });
    console.log('✓ Скриншот 3 сохранен: 03_onboarding_estimate.png');

    const finishBtn = await page.$('#btn-finish-open');
    if (finishBtn) await finishBtn.click();
    await new Promise((r) => setTimeout(r, 1200));

    // Проверяем, открылся ли сюжетный диалог «Внутренний голос»
    console.log('5. Обработка сюжетного диалога...');
    const storyChoiceBtn = await page.$('button[data-choice="0"]');
    if (storyChoiceBtn) {
      console.log('✓ Закрываем стартовый сюжетный диалог');
      await storyChoiceBtn.click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // ШАГ 3: Чистый скриншот игровой сцены (Бокс 1, целевая машина, HUD, джойстик)
    const s4 = path.join(SCREENSHOT_DIR, '04_gameplay_scene_clean.png');
    await page.screenshot({ path: s4 });
    results.screenshots.push({ name: 'Игровая сцена (чистая)', path: s4 });
    console.log('✓ Скриншот 4 сохранен: 04_gameplay_scene_clean.png');
    results.flowStepsCompleted.push('Игровая сцена запущена');

    // ШАГ 4: Перемещение игрока к Боксу 1 и мойка
    console.log('6. Приближение персонажа к боксу 1...');
    await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.keys?.CarWashScene;
      if (scene && scene.player) {
        scene.player.setPosition(310, 325);
      }
    });
    await new Promise((r) => setTimeout(r, 600));

    const s4b = path.join(SCREENSHOT_DIR, '04b_player_at_car.png');
    await page.screenshot({ path: s4b });
    console.log('✓ Скриншот 4b сохранен: 04b_player_at_car.png');

    // Нажатие кнопки мойки
    const actionBtn = await page.$('#mobile-action-btn');
    if (actionBtn) {
      console.log('✓ Нажимаем НАЧАТЬ МОЙКУ');
      await actionBtn.click();
      await new Promise((r) => setTimeout(r, 300));
      // Нанесение пены
      await actionBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    const s5 = path.join(SCREENSHOT_DIR, '05_washing_foam_action.png');
    await page.screenshot({ path: s5 });
    results.screenshots.push({ name: 'Процесс мойки: пена', path: s5 });
    console.log('✓ Скриншот 5 сохранен: 05_washing_foam_action.png');

    // Продолжаем смыв и финишную обработку
    for (let i = 0; i < 8; i++) {
      if (actionBtn) await actionBtn.click();
      await new Promise((r) => setTimeout(r, 200));
    }

    await new Promise((r) => setTimeout(r, 1000));
    const s6 = path.join(SCREENSHOT_DIR, '06_wash_completed_sparkles.png');
    await page.screenshot({ path: s6 });
    results.screenshots.push({ name: 'Мойка завершена и оплачена', path: s6 });
    console.log('✓ Скриншот 6 сохранен: 06_wash_completed_sparkles.png');
    results.flowStepsCompleted.push('Мойка автомобиля завершена');

    // ШАГ 5: Панель Бизнеса и найм сотрудника
    console.log('7. Открытие панели бизнеса и найм сотрудника...');
    const bizBtn = await page.$('#hud-btn-business');
    if (bizBtn) {
      await bizBtn.click();
      await new Promise((r) => setTimeout(r, 600));

      const s7 = path.join(SCREENSHOT_DIR, '07_business_panel.png');
      await page.screenshot({ path: s7 });
      results.screenshots.push({ name: 'Панель Бизнес', path: s7 });
      console.log('✓ Скриншот 7 сохранен: 07_business_panel.png');

      const hireBtn = await page.$('#btn-hire');
      if (hireBtn) {
        await hireBtn.click();
        console.log('✓ Сотрудник нанят!');
        await new Promise((r) => setTimeout(r, 400));
      }

      const closeBiz = await page.$('#business-close');
      if (closeBiz) await closeBiz.click();
    }

    await new Promise((r) => setTimeout(r, 1000));
    const s8 = path.join(SCREENSHOT_DIR, '08_employee_spawned.png');
    await page.screenshot({ path: s8 });
    results.screenshots.push({ name: 'Сотрудник на карте автомойки', path: s8 });
    console.log('✓ Скриншот 8 сохранен: 08_employee_spawned.png');
    results.flowStepsCompleted.push('Сотрудник нанят и виден на карте');

    // Аудио состояние
    results.audioState = await page.evaluate(() => {
      const a = window.__audioManager;
      return {
        exists: !!a,
        sfxEnabled: a ? a.sfxEnabled : null,
        masterVolume: a ? a.masterVolume : null,
        ctxState: a && a.ctx ? a.ctx.state : 'uninitialized',
      };
    });

    // ШАГ 6: Панель Улучшений
    console.log('8. Открытие панели улучшений...');
    const upgBtn = await page.$('#hud-btn-upgrades');
    if (upgBtn) {
      await upgBtn.click();
      await new Promise((r) => setTimeout(r, 600));

      const s9 = path.join(SCREENSHOT_DIR, '09_upgrades_panel.png');
      await page.screenshot({ path: s9 });
      results.screenshots.push({ name: 'Панель Улучшений', path: s9 });
      console.log('✓ Скриншот 9 сохранен: 09_upgrades_panel.png');

      const closeUpg = await page.$('#upgrade-close');
      if (closeUpg) await closeUpg.click();
    }
    await new Promise((r) => setTimeout(r, 500));

    // ШАГ 7: Завершение рабочей смены
    console.log('9. Завершение рабочей смены...');
    const endShiftBtn = await page.$('#hud-btn-end-shift');
    if (endShiftBtn) {
      await endShiftBtn.click();
      await new Promise((r) => setTimeout(r, 1000));

      const s10 = path.join(SCREENSHOT_DIR, '10_shift_report.png');
      await page.screenshot({ path: s10 });
      results.screenshots.push({ name: 'Финансовый отчет за смену', path: s10 });
      console.log('✓ Скриншот 10 сохранен: 10_shift_report.png');
      results.flowStepsCompleted.push('Смена завершена');
    }

  } catch (err) {
    console.error('Ошибка во время QA сценария:', err);
    results.errors.push(err.toString());
  } finally {
    results.errors.push(...errors);
    await browser.close();
    await server.close();
    console.log('\n=== BROWSER QA ЗАВЕРШЕН ===');
  }

  const reportPath = path.join(SCREENSHOT_DIR, 'qa_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
}

runBrowserQA().catch((err) => {
  console.error('Fatal QA error:', err);
  process.exit(1);
});
