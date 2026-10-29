/**
 * CarWashScene — оптимизированная сцена с гарантированной целевой машиной в боксе 1
 * на старте новой игры, интерактивной неоновой рамкой подсветки цели,
 * depth-сортировкой (пол < машина < навес бокса < персонаж), проверками инспекций
 * и полноценным Fullscreen.
 */
import gameState from '../systems/GameState.js';
import BALANCE from '../config/balance.js';
import saveSystem from '../systems/SaveSystem.js';
import { createHUD, updateHUD, destroyHUD } from '../../ui/HudUI.js';
import { showWashProgress, hideWashProgress } from '../../ui/WashProgressUI.js';
import { showToast } from '../../ui/ToastUI.js';
import { StorySystem } from '../systems/StorySystem.js';
import { tutorialSystem, TutorialSystem } from '../systems/TutorialSystem.js';
import { audioManager } from '../systems/AudioManager.js';
import { getShiftClock, getDayCycleProfile } from '../systems/DayCycle.js';

const WORLD = {
  width: 900,
  height: 640,
  building: { x: 450, y: 105 },
  posts: [
    { x: 300, y: 310, label: 'Бокс 1' },
    { x: 600, y: 310, label: 'Бокс 2' },
    { x: 130, y: 402, label: 'Бокс 3', expansion: true },
    { x: 770, y: 402, label: 'Бокс 4', expansion: true },
  ],
  queueStart: { x: 130, y: 490 },
  queueSpacing: 70,
  entrance: { x: 40, y: 575 },
  exit: { x: 860, y: 575 },
  roadY: 585,
  playerStart: { x: 450, y: 390 },
};

export default class CarWashScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CarWashScene' });
  }

  create() {
    this._destroyed = false;
    this.cameras.main.setBackgroundColor('#0b0e14');

    this._createEnvironment();
    this._createPlayer();
    this._setupControls();

    this._carSprites = {};
    this._washingCar = null;
    this._isWashing = false;
    this._coffeeRushUntil = 0;

    this._spawnTimer = 0;
    this._shiftTimer = 0;
    this._employeeTimers = {};
    this._employeeSprites = {};
    this._walkAnimTimer = 0;
    this._walkFrame = 0;
    this._dayCycleUpdateTimer = 0;
    this._createDayCycleEffects();

    // Графический маркер подсветки целевой машины во время обучения
    this._targetHighlight = this.add.graphics();
    this._targetHighlight.setDepth(18);

    // Слой струи воды и пены высокого давления
    this._sprayGfx = this.add.graphics();
    this._sprayGfx.setDepth(22);

    // One shared lightweight canvas layer tracks waiting-customer patience without
    // creating dozens of per-car DOM elements or particle emitters.
    this._queueMoodGfx = this.add.graphics().setDepth(20.4);
    this._queueMoodUpdateTimer = 0;

    this._storySystem = new StorySystem();
    this._tutorialSystem = tutorialSystem;

    createHUD(this);
    saveSystem.startAutoSave();

    // Если это новая игра и посты пусты — сразу ставим первую машину в Бокс 1!
    this._ensureInitialCar();

    this._storySystem.checkEvents(this);

    if (!gameState.tutorialCompleted) {
      this._tutorialSystem.start(this);
    }

    this._onStateChanged = () => {
      updateHUD();
      this._updateUpgradeVisuals();
    };
    gameState.on('stateChanged', this._onStateChanged);
    this._onAchievementUnlocked = (achievement) => {
      audioManager.play('success');
      showToast(`🏆 ${achievement.title} · +${this._formatMoney(achievement.reward)}`, 'success');
      if (this.player) this._spawnCleanSparkles(this.player.x, this.player.y - 20);
    };
    gameState.on('achievementUnlocked', this._onAchievementUnlocked);

    this.scale.on('resize', this._handleResize, this);
    this._handleResize({ width: this.scale.width, height: this.scale.height });

    this._isCameraFollowingPlayer = false;
    this._updateCameraTracking(true);

    updateHUD();
  }

  /** Гарантированное размещение первой обучающей машины в боксе 1 */
  _ensureInitialCar() {
    this._tutorialSystem.ensureTargetCar(this);
  }

  _handleResize(gameSize) {
    const width = Math.max(1, gameSize.width);
    const height = Math.max(1, gameSize.height);
    const minDim = Math.min(width, height);
    const portraitPhone = width < 460 && height > width;

    // Keep the established, readable camera scale. The previous 0.68 zoom on
    // portrait phones made the yard tiny and pushed the player visually away.
    // Slightly wider view shows more of the yard without making the player tiny.
    let targetZoom = 1.08;
    if (minDim < 360) targetZoom = 0.92;
    else if (minDim < 420) targetZoom = 0.96;
    else if (minDim < 650) targetZoom = 1.0;

    const cam = this.cameras.main;
    cam.setZoom(targetZoom);
    cam.setBounds(0, 0, WORLD.width, WORLD.height);

    // Keep character scale stable; don't enlarge the sprite just because the
    // viewport is portrait. The camera tracks the player after the tutorial.
    if (this.player) this.player.setScale(0.5);

    // Recompute the active camera target after viewport/orientation changes.
    if (this.player) this._updateCameraTracking(true);
  }

  _createEnvironment() {
    // Детализированная векторная сцена: резкие SVG-материалы масштабируются без мыла.
    const environment = this.add.image(WORLD.width / 2, WORLD.height / 2, 'wash-yard-art')
      .setDisplaySize(WORLD.width, WORLD.height)
      .setDepth(0);

    // Здание и боксы отдельными слоями, чтобы машины и сотрудники оставались игровыми спрайтами.
    this._building = this.add.image(WORLD.building.x, WORLD.building.y, 'wash-building-art')
      .setDisplaySize(560, 194)
      .setDepth(5);
    this._createOfficeEntrance();

    this._postSprites = [];
    this._postStatusLabels = [];
    for (let i = 0; i < WORLD.posts.length; i++) {
      const pos = WORLD.posts[i];
      const postData = gameState.posts[i];
      const texture = postData.broken ? 'wash-bay-broken-art' : 'wash-bay-art';
      const compactExpansion = !!pos.expansion;
      const sprite = this.add.image(pos.x, pos.y, texture)
        .setDisplaySize(compactExpansion ? 176 : 300, compactExpansion ? 112 : 192)
        .setDepth(6);
      if (postData.unlocked === false) sprite.setAlpha(0.16);

      const label = this.add.text(pos.x, pos.y - (compactExpansion ? 76 : 112),
        postData.unlocked === false ? `${pos.label.toUpperCase()} · ЗАКРЫТ` : `${pos.label.toUpperCase()} · ГОТОВ`, {
        fontSize: compactExpansion ? '9px' : '11px',
        color: '#8df4ff',
        backgroundColor: 'rgba(5, 12, 24, 0.98)',
        padding: compactExpansion ? { x: 6, y: 4 } : { x: 8, y: 4 },
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontStyle: 'bold',
        stroke: '#07111f',
        strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true },
      }).setOrigin(0.5).setDepth(8);
      if (postData.unlocked === false) label.setColor('#94a3b8');

      this._postSprites.push(sprite);
      this._postStatusLabels.push(label);
    }

    this._createGroundMarkings();
    this._createAmbientLighting();
    this._createScenery();
    this._createCityDetails();
    this._createUpgradeVisuals();

    this.physics.world.setBounds(20, 170, WORLD.width - 40, WORLD.height - 210);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
  }


  /**
   * Visual feedback for purchased upgrades, using lightweight graphics only.
   * No gameplay values are changed here; GameState remains the source of truth.
   */
  _createUpgradeVisuals() {
    this._upgradeVisuals = this.add.graphics().setDepth(7.6);
    this._updateUpgradeVisuals();
  }

  _updateUpgradeVisuals() {
    if (!this._upgradeVisuals) return;
    const g = this._upgradeVisuals;
    g.clear();

    const levels = [
      Math.min(3, gameState.upgrades.washSpeed || 0),
      Math.min(3, gameState.upgrades.equipmentQuality || 0),
      Math.min(3, gameState.upgrades.reliability || 0),
    ];
    const colors = [0x38bdf8, 0xfbbf24, 0x4ade80];

    // Tiny status lamps on each bay's fascia make equipment upgrades visible in-world.
    for (const pos of WORLD.posts) {
      g.fillStyle(0x07111d, 0.9);
      g.fillRoundedRect(pos.x - 39, pos.y - 82, 78, 13, 3);
      g.lineStyle(1, 0x64748b, 0.58);
      g.strokeRoundedRect(pos.x - 39, pos.y - 82, 78, 13, 3);
      let offset = pos.x - 29;
      for (let group = 0; group < levels.length; group++) {
        for (let led = 0; led < 3; led++) {
          const active = led < levels[group];
          g.fillStyle(colors[group], active ? 0.95 : 0.15);
          g.fillRoundedRect(offset + led * 7, pos.y - 78, 4, 5, 1);
          if (active) {
            g.fillStyle(colors[group], 0.12);
            g.fillCircle(offset + led * 7 + 2, pos.y - 75.5, 5);
          }
        }
        offset += 22;
      }
    }

    // Capacity upgrade is represented by additional illuminated queue markers.
    const capacityLevel = Math.min(3, gameState.upgrades.capacity || 0);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(i < capacityLevel ? 0x4ade80 : 0x64748b, i < capacityLevel ? 0.8 : 0.22);
      g.fillRoundedRect(100 + i * 13, 462, 8, 3, 1);
    }
  }

  /**
   * A clear, lightweight office entrance layered onto the existing building art.
   * It is decorative only; business state remains managed by the existing UI.
   */
  _createOfficeEntrance() {
    const g = this.add.graphics().setDepth(5.35);

    // Recessed doorway, glass panels and a warm interior light.
    g.fillStyle(0x050b15, 0.92);
    g.fillRoundedRect(419, 135, 62, 57, 4);
    g.lineStyle(2, 0x7dd3fc, 0.8);
    g.strokeRoundedRect(419, 135, 62, 57, 4);
    g.fillStyle(0x18364a, 0.98);
    g.fillRoundedRect(424, 140, 52, 47, 2);
    g.fillStyle(0xffd28a, 0.18);
    g.fillRoundedRect(427, 143, 46, 41, 2);
    g.lineStyle(1, 0x9eeeff, 0.55);
    g.lineBetween(450, 141, 450, 186);
    g.fillStyle(0xffd28a, 0.85);
    g.fillCircle(468, 164, 2);

    // Steps and a restrained cyan edge light.
    g.fillStyle(0x172638, 1);
    g.fillRoundedRect(412, 188, 76, 6, 2);
    g.fillStyle(0x7dd3fc, 0.78);
    g.fillRoundedRect(418, 188, 64, 1.5, 1);

    // Compact readable office sign.
    g.fillStyle(0x07111d, 0.96);
    g.fillRoundedRect(409, 113, 82, 17, 3);
    g.lineStyle(1, 0x38bdf8, 0.78);
    g.strokeRoundedRect(409, 113, 82, 17, 3);
    this.add.text(450, 121.5, 'УПРАВЛЕНИЕ', {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#e6faff',
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(5.45);

    // A subtle ground marker makes the interaction point easy to find.
    const marker = this.add.ellipse(450, 198, 46, 12, 0x38bdf8, 0.12).setDepth(5.1);
    this.tweens.add({
      targets: marker,
      alpha: { from: 0.12, to: 0.32 },
      scaleX: { from: 0.9, to: 1.12 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  /**
   * Static city dressing around the playable yard.
   * Kept as lightweight Phaser Graphics + existing generated car textures:
   * no extra library, no new save data, and no changes to collision/gameplay.
   */
  _createCityDetails() {
    const architecture = this.add.graphics().setDepth(1.4);
    const drawFacade = (x, y, width, height, accent, title, subtitle) => {
      // Ground shadow and raised curb make the facade sit in the scene.
      architecture.fillStyle(0x030711, 0.32);
      architecture.fillEllipse(x + width / 2 + 3, y + height + 8, width + 22, 16);
      architecture.fillStyle(0x5d7180, 0.9);
      architecture.fillRoundedRect(x - 5, y + height - 2, width + 10, 9, 2);
      architecture.fillStyle(0x111a29, 0.98);
      architecture.fillRoundedRect(x, y, width, height, 5);
      architecture.fillStyle(0x26384a, 0.96);
      architecture.fillRoundedRect(x + 4, y + 4, width - 8, height - 8, 3);
      architecture.fillStyle(0x0b1422, 0.95);
      architecture.fillRoundedRect(x + 8, y + 10, width - 16, height - 27, 2);
      // Warm interior glass with cool vertical mullions.
      architecture.fillStyle(0x9ac5c8, 0.28);
      architecture.fillRect(x + 11, y + 13, width - 22, height - 34);
      architecture.fillStyle(0xffd28a, 0.23);
      architecture.fillRect(x + 14, y + 16, width - 28, height - 40);
      architecture.lineStyle(2, 0x0d1b2a, 0.9);
      architecture.strokeLineShape(new Phaser.Geom.Line(x + width * 0.36, y + 12, x + width * 0.36, y + height - 20));
      architecture.strokeLineShape(new Phaser.Geom.Line(x + width * 0.65, y + 12, x + width * 0.65, y + height - 20));
      // Canopy and thin illuminated trim.
      architecture.fillStyle(0x172638, 1);
      architecture.fillRoundedRect(x - 4, y + 5, width + 8, 8, 2);
      architecture.fillStyle(accent, 0.88);
      architecture.fillRoundedRect(x + 8, y + 7, width - 16, 2, 1);
      architecture.fillStyle(0x0b1420, 0.98);
      architecture.fillRoundedRect(x + 9, y + height - 21, width - 18, 14, 3);
      architecture.lineStyle(1, accent, 0.7);
      architecture.strokeRoundedRect(x + 9, y + height - 21, width - 18, 14, 3);
      this.add.text(x + width / 2, y + height - 14, title, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '7px',
        fontStyle: 'bold',
        color: '#eaf7ff',
        stroke: '#07111b',
        strokeThickness: 2,
        align: 'center',
      }).setOrigin(0.5).setDepth(2.1);
      this.add.text(x + width / 2, y + height + 15, subtitle, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '7px',
        fontStyle: 'bold',
        color: '#9bb1c4',
        stroke: '#0b111b',
        strokeThickness: 2,
        align: 'center',
      }).setOrigin(0.5).setDepth(2.1);
    };

    // Small neighbouring businesses frame the car wash without covering either bay.
    drawFacade(28, 188, 112, 72, 0x4bd5e5, 'CITY AUTO', 'ЗАПЧАСТИ');
    drawFacade(760, 188, 112, 72, 0xffb86b, 'COFFEE STOP', 'КОФЕ · ОЖИДАНИЕ');

    // Steam drifting from the cafe makes the neighbouring business feel alive.
    this._coffeeSteam = [];
    for (let i = 0; i < 3; i++) {
      const steam = this.add.circle(806 + i * 9, 202 + (i % 2) * 3, 2.2, 0xffe4bd, 0.45)
        .setDepth(3.2 + i * 0.001);
      this._coffeeSteam.push(steam);
      this.tweens.add({
        targets: steam,
        y: steam.y - 13 - i * 2,
        x: steam.x + (i % 2 ? 4 : -3),
        alpha: 0,
        scale: 1.7,
        duration: 1800 + i * 260,
        delay: i * 420,
        repeat: -1,
        onRepeat: () => {
          if (steam.active) { steam.setPosition(806 + i * 9, 202 + (i % 2) * 3); steam.setAlpha(0.45); steam.setScale(1); }
        },
      });
    }

    // Marked customer parking pockets at the far edges of the lot.
    const parking = this.add.graphics().setDepth(2.55);
    for (const side of [{ x: 63, y: 322 }, { x: 737, y: 322 }]) {
      parking.fillStyle(0x050912, 0.22);
      parking.fillRoundedRect(side.x - 8, side.y - 22, 108, 62, 5);
      parking.lineStyle(1.5, 0xd8e5ed, 0.48);
      parking.strokeLineShape(new Phaser.Geom.Line(side.x, side.y - 19, side.x, side.y + 31));
      parking.strokeLineShape(new Phaser.Geom.Line(side.x + 45, side.y - 19, side.x + 45, side.y + 31));
      parking.strokeLineShape(new Phaser.Geom.Line(side.x + 90, side.y - 19, side.x + 90, side.y + 31));
      parking.lineStyle(2, 0x38bdf8, 0.24);
      parking.strokeLineShape(new Phaser.Geom.Line(side.x - 5, side.y + 35, side.x + 95, side.y + 35));
    }

    // Parked cars use the same high-resolution generated textures as customer cars.
    // Their low depth keeps live cars, workers and effects fully interactive in front.
    const parkedCars = [
      { x: 86, y: 335, key: 'car_suv', scale: 0.27, tint: 0x8da7c5 },
      { x: 782, y: 335, key: 'car_premium', scale: 0.27, tint: 0xd5c4a0 },
    ];
    for (const car of parkedCars) {
      const shadow = this.add.ellipse(car.x + 2, car.y + 8, 43, 20, 0x02050a, 0.42).setDepth(2.7);
      const sprite = this.add.image(car.x, car.y, car.key)
        .setScale(car.scale)
        .setTint(car.tint)
        .setDepth(2.85);
      // A tiny windshield glint helps the miniature vehicles read as glossy objects.
      const glint = this.add.graphics().setDepth(2.9);
      glint.lineStyle(1, 0xe6f7ff, 0.55);
      glint.lineBetween(car.x - 5, car.y - 4, car.x + 3, car.y - 6);
      sprite.setData('cityParkingCar', true);
      shadow.setData('cityParkingShadow', true);
    }

    // Directional signs and reflective bollards add legibility at the entrance/exit.
    const signs = this.add.graphics().setDepth(4.2);
    for (const sign of [
      { x: 22, y: 432, color: 0x38bdf8, label: 'IN' },
      { x: 878, y: 432, color: 0x4ade80, label: 'OUT' },
    ]) {
      signs.fillStyle(0x050b14, 0.35);
      signs.fillEllipse(sign.x, sign.y + 18, 17, 6);
      signs.fillStyle(0x263647, 1);
      signs.fillRoundedRect(sign.x - 2, sign.y - 2, 4, 22, 1);
      signs.fillStyle(sign.color, 0.9);
      signs.fillRoundedRect(sign.x - 13, sign.y - 11, 26, 14, 3);
      signs.lineStyle(1, 0xeaf8ff, 0.45);
      signs.strokeRoundedRect(sign.x - 13, sign.y - 11, 26, 14, 3);
      this.add.text(sign.x, sign.y - 4, sign.label, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '7px',
        fontStyle: 'bold',
        color: '#06111c',
      }).setOrigin(0.5).setDepth(4.3);
    }

    // Small pavement studs: deliberately sparse so they read as guidance, not noise.
    const studs = this.add.graphics().setDepth(3.3);
    for (let i = 0; i < 9; i++) {
      const x = 195 + i * 64;
      studs.fillStyle(i % 3 === 0 ? 0xffbd73 : 0x82eaff, i % 3 === 0 ? 0.52 : 0.28);
      studs.fillRoundedRect(x, 535, 8, 2, 1);
      studs.fillStyle(0xe6f8ff, 0.12);
      studs.fillRoundedRect(x + 12, 541, 14, 1, 0);
    }
  }

  _createDayCycleEffects() {
    // A subtle full-world color grade makes the passage of the shift visible
    // without changing the artwork itself. Practical lights glow brighter at dusk.
    this._dayAtmosphere = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0xffd19a, 0)
      .setDepth(22.7)
      .setBlendMode(Phaser.BlendModes.NORMAL);
    this._dayTint = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0xffffff, 0)
      .setDepth(23)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this._dayLights = this.add.graphics()
      .setDepth(24)
      .setBlendMode(Phaser.BlendModes.ADD);
    this._updateDayCycle();
  }

  _updateDayCycle() {
    if (!this._dayTint || !this._dayLights) return;
    const clock = getShiftClock(gameState.shiftTimeRemaining, BALANCE.time);
    const profile = getDayCycleProfile(clock.hour);
    this._dayTint.setFillStyle(profile.tintColor, profile.tintAlpha);
    const atmosphereAlpha = clock.hour < 9 ? 0.13 : clock.hour < 10 ? 0.075 : clock.hour >= 19 ? 0.045 : clock.hour >= 17.5 ? 0.055 : 0.018;
    this._dayAtmosphere.setFillStyle(profile.tintColor, atmosphereAlpha);
    this.cameras.main.setBackgroundColor(profile.tintColor);

    const lights = this._dayLights;
    lights.clear();
    const intensity = profile.lampAlpha;
    // Warm low-angle sunlight makes morning read as morning, not as a dark night map.
    if (clock.hour < 10.5) {
      const morningStrength = clock.hour < 9 ? 0.12 : 0.065;
      lights.fillStyle(0xffb85e, morningStrength * 0.28);
      lights.fillCircle(450, 115, 230);
      lights.fillStyle(0xffd18a, morningStrength * 0.34);
      lights.fillEllipse(450, 320, 570, 250);
      lights.fillStyle(0xffe0a3, morningStrength * 0.18);
      for (const pos of WORLD.posts.slice(0, 2)) lights.fillEllipse(pos.x, pos.y + 18, 115, 48);
    }
    if (intensity > 0.005) {
      // Concentric additive halos imitate warm lamps reflecting on wet concrete.
      for (const pos of WORLD.posts) {
        lights.fillStyle(0xffcb79, intensity * 0.035);
        lights.fillCircle(pos.x, pos.y + 18, 88);
        lights.fillStyle(0xffd896, intensity * 0.055);
        lights.fillCircle(pos.x, pos.y + 18, 56);
        lights.fillStyle(0xffefc2, intensity * 0.075);
        lights.fillEllipse(pos.x, pos.y + 23, 78, 27);
      }
      for (const x of [30, 870]) {
        lights.fillStyle(0xffd27a, intensity * 0.055);
        lights.fillCircle(x, 280, 60);
        lights.fillStyle(0xffe4a3, intensity * 0.09);
        lights.fillCircle(x, 280, 29);
      }
      lights.fillStyle(0xffbf69, intensity * 0.06);
      lights.fillRoundedRect(405, 84, 90, 5, 2);
    }
  }

  _createGroundMarkings() {
    const mg = this.add.graphics();
    mg.setDepth(3);

    // Влажные пятна с отражениями под моечными боксами
    for (let i = 0; i < WORLD.posts.length; i++) {
      const pos = WORLD.posts[i];
      mg.fillStyle(0x0ea5e9, 0.08);
      mg.fillEllipse(pos.x, pos.y + 16, 170, 75);
      mg.fillStyle(0x38bdf8, 0.05);
      mg.fillEllipse(pos.x, pos.y + 14, 130, 50);
    }

    // Дренажные решетки перед боксами
    this.add.image(WORLD.posts[0].x, WORLD.posts[0].y + 60, 'drainage_grate').setDepth(3);
    this.add.image(WORLD.posts[1].x, WORLD.posts[1].y + 60, 'drainage_grate').setDepth(3);

    // Пешеходный переход безопасности (желто-белая разметка)
    mg.fillStyle(0xf59e0b, 0.85);
    for (let y = 195; y < 270; y += 12) {
      mg.fillRect(435, y, 30, 6);
    }

    // Направляющие линии въезда
    mg.lineStyle(2, 0x38bdf8, 0.6);
    mg.strokeLineShape(new Phaser.Geom.Line(WORLD.entrance.x + 20, WORLD.entrance.y - 20, 130, 490));

    // Направляющие линии выезда
    mg.lineStyle(2, 0x22c55e, 0.6);
    mg.strokeLineShape(new Phaser.Geom.Line(WORLD.posts[1].x + 90, WORLD.posts[1].y + 20, WORLD.exit.x - 20, WORLD.exit.y - 20));

    // Трафаретные указатели движения
    this.add.text(WORLD.entrance.x, WORLD.entrance.y - 32, '➔ ВЪЕЗД', {
      fontSize: '12px',
      color: '#38bdf8',
      fontStyle: 'bold',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      padding: { x: 6, y: 2 },
    }).setDepth(4);

    this.add.text(WORLD.exit.x, WORLD.exit.y - 32, 'ВЫЕЗД ➔', {
      fontSize: '12px',
      color: '#22c55e',
      fontStyle: 'bold',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      padding: { x: 6, y: 2 },
    }).setOrigin(1, 0).setDepth(4);
  }

  _createAmbientLighting() {
    const light = this.add.graphics().setDepth(3.4);

    // Мягкие бирюзовые световые лужи от оборудования моечных постов.
    for (const pos of WORLD.posts) {
      light.fillStyle(0x22d3ee, 0.025);
      light.fillEllipse(pos.x, pos.y + 28, 190, 86);
      light.fillStyle(0x22d3ee, 0.035);
      light.fillEllipse(pos.x, pos.y + 25, 145, 62);
      light.fillStyle(0x67e8f9, 0.045);
      light.fillEllipse(pos.x, pos.y + 22, 92, 32);

      // Длинные блики на мокром бетоне, будто отражаются световые панели.
      light.fillStyle(0x9be7ff, 0.14);
      light.fillRoundedRect(pos.x - 66, pos.y + 43, 38, 2, 1);
      light.fillStyle(0x67e8f9, 0.1);
      light.fillRoundedRect(pos.x + 19, pos.y + 55, 51, 2, 1);
      light.fillStyle(0xffffff, 0.08);
      light.fillRoundedRect(pos.x - 12, pos.y + 62, 21, 1, 1);
    }

    // Тёплые закатные рефлексы на дороге контрастируют с холодным светом мойки.
    light.fillStyle(0xfb923c, 0.035);
    light.fillEllipse(130, WORLD.roadY + 3, 150, 22);
    light.fillEllipse(770, WORLD.roadY + 1, 180, 18);
    light.fillStyle(0xfbbf24, 0.08);
    light.fillRoundedRect(95, WORLD.roadY + 5, 52, 2, 1);
    light.fillRoundedRect(720, WORLD.roadY - 4, 37, 2, 1);

    // Мокрые отражения: несколько разной длины полос вместо равномерного шума.
    // Группируем их в перспективные следы, чтобы покрытие читалось как мокрый бетон.
    const reflections = [
      [214, 391, 54, 2, 0x9be7ff, 0.17],
      [284, 410, 23, 1, 0xffffff, 0.13],
      [326, 431, 69, 2, 0x38bdf8, 0.12],
      [470, 397, 36, 1, 0xffffff, 0.12],
      [512, 448, 74, 2, 0xe2e8f0, 0.14],
      [574, 430, 29, 1, 0x67e8f9, 0.17],
      [346, 489, 42, 2, 0xfb923c, 0.12],
      [403, 515, 81, 2, 0x38bdf8, 0.09],
      [612, 500, 44, 1, 0xffffff, 0.11],
      [256, 535, 28, 1, 0x67e8f9, 0.13],
      [690, 420, 32, 1, 0xfb923c, 0.1],
      [162, 453, 36, 1, 0xffffff, 0.1],
    ];
    for (const [x, y, w, h, color, alpha] of reflections) {
      light.fillStyle(color, alpha);
      light.fillRoundedRect(x, y, w, h, 1);
      if (w > 40) {
        light.fillStyle(color, alpha * 0.35);
        light.fillRoundedRect(x + w * 0.2, y + 3, w * 0.45, 1, 1);
      }
    }

    // Низкие направляющие световые маркеры вдоль прохода.
    for (let i = 0; i < 6; i++) {
      const y = 326 + i * 31;
      const alpha = 0.16 - i * 0.012;
      light.fillStyle(0x22d3ee, alpha);
      light.fillRoundedRect(118, y, 7, 2, 1);
      light.fillRoundedRect(775, y, 7, 2, 1);
    }

    // Сохранённые царапины и тонкие кромочные блики.
    light.lineStyle(1, 0xe2e8f0, 0.09);
    light.strokeLineShape(new Phaser.Geom.Line(230, 420, 273, 418));
    light.strokeLineShape(new Phaser.Geom.Line(520, 448, 582, 445));
    light.strokeLineShape(new Phaser.Geom.Line(350, 530, 391, 529));
    light.lineStyle(1, 0x67e8f9, 0.1);
    light.strokeLineShape(new Phaser.Geom.Line(235, 352, 260, 350));
    light.strokeLineShape(new Phaser.Geom.Line(635, 365, 673, 363));

    // Небольшая тёплая подсветка у входа помогает считывать направление движения.
    light.fillStyle(0xf59e0b, 0.045);
    light.fillEllipse(WORLD.entrance.x + 55, WORLD.entrance.y - 35, 78, 38);
    light.fillStyle(0x22c55e, 0.035);
    light.fillEllipse(WORLD.exit.x - 40, WORLD.exit.y - 35, 82, 34);

    // Wet-ground specular streaks: clustered by light source, with darker
    // gaps between them so the concrete reads glossy rather than uniformly blue.
    const puddleGroups = [
      { x: WORLD.posts[0].x, y: WORLD.posts[0].y + 82, color: 0x38bdf8 },
      { x: WORLD.posts[1].x, y: WORLD.posts[1].y + 82, color: 0x67e8f9 },
    ];
    for (const puddle of puddleGroups) {
      light.fillStyle(0x020711, 0.12);
      light.fillEllipse(puddle.x + 4, puddle.y + 7, 142, 29);
      light.fillStyle(puddle.color, 0.055);
      light.fillEllipse(puddle.x, puddle.y + 1, 128, 22);
      light.fillStyle(0xe0f2fe, 0.12);
      light.fillRoundedRect(puddle.x - 47, puddle.y - 2, 26, 1.5, 1);
      light.fillStyle(puddle.color, 0.1);
      light.fillRoundedRect(puddle.x + 12, puddle.y + 4, 43, 1.5, 1);
      light.fillStyle(0xffffff, 0.08);
      light.fillRoundedRect(puddle.x - 8, puddle.y + 8, 14, 1, 1);
    }

    // Short broken reflections beneath the building frontage give a subtle
    // sense of wet paving without creating a noisy repeated pattern.
    const frontageReflections = [
      [188, 278, 34, 1, 0xf8fafc, 0.1],
      [232, 286, 18, 1, 0x67e8f9, 0.11],
      [678, 279, 41, 1, 0xffd28a, 0.11],
      [731, 286, 23, 1, 0xe0f2fe, 0.09],
      [386, 301, 29, 1, 0x94a3b8, 0.08],
      [549, 307, 36, 1, 0x67e8f9, 0.08],
    ];
    for (const [x, y, width, height, color, alpha] of frontageReflections) {
      light.fillStyle(color, alpha);
      light.fillRoundedRect(x, y, width, height, 1);
    }

    // Soft shadow under the car-wash bay apron anchors the buildings to the lot.
    light.fillStyle(0x02040a, 0.16);
    for (const pos of WORLD.posts) {
      light.fillEllipse(pos.x, pos.y + 69, 184, 18);
      light.fillStyle(0x0b1522, 0.14);
      light.fillEllipse(pos.x, pos.y + 72, 150, 10);
    }
  }

  _createScenery() {
    // Зеленые насаждения в кадках
    this.add.image(170, 180, 'potted_tree').setDepth(7);
    this.add.image(730, 180, 'potted_tree').setDepth(7);
    this.add.image(450, 480, 'potted_tree').setDepth(7);

    // Уличные фонари с мягким световым ореолом
    const lamp1 = this.add.image(30, 260, 'lamp_post').setDepth(7);
    const lamp2 = this.add.image(870, 260, 'lamp_post').setDepth(7);

    const lg = this.add.graphics().setDepth(3);
    // Световые круги на земле от фонарей
    lg.fillStyle(0xfef08a, 0.05);
    lg.fillCircle(30, 280, 50);
    lg.fillCircle(870, 280, 50);

    // Ограждающие конусы
    this.add.image(WORLD.entrance.x + 35, WORLD.entrance.y - 60, 'cone').setDepth(7);
    this.add.image(WORLD.entrance.x + 65, WORLD.entrance.y - 60, 'cone').setDepth(7);

    // Контрастные въездные маркеры и световые studs по периметру площадки.
    const perimeter = this.add.graphics().setDepth(3.2);
    perimeter.lineStyle(2, 0x0b1320, 0.7);
    perimeter.strokeLineShape(new Phaser.Geom.Line(66, 112, 834, 112));
    perimeter.strokeLineShape(new Phaser.Geom.Line(66, 428, 834, 428));
    for (let i = 0; i < 16; i++) {
      const x = 86 + i * 48;
      perimeter.fillStyle(i % 4 === 0 ? 0xfb923c : 0x38bdf8, i % 4 === 0 ? 0.78 : 0.36);
      perimeter.fillRoundedRect(x, 117, i % 4 === 0 ? 15 : 8, 2, 1);
      perimeter.fillStyle(0x67e8f9, 0.22);
      perimeter.fillRoundedRect(x + 12, 423, 10, 2, 1);
    }

    // Вытянутые следы воды у дренажа и перед рабочими постами.
    const water = this.add.graphics().setDepth(3.15);
    for (let i = 0; i < 10; i++) {
      const x = 180 + i * 59;
      const y = 352 + (i % 3) * 31;
      water.fillStyle(i % 2 ? 0x67e8f9 : 0x94a3b8, 0.075 + (i % 3) * 0.018);
      water.fillEllipse(x, y, 18 + (i % 4) * 7, 2 + (i % 2));
    }
  }

  _updatePostStatuses() {
    if (!this._postStatusLabels) return;
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      const lbl = this._postStatusLabels[i];
      if (!lbl) continue;

      if (post.unlocked === false) {
        lbl.setText(`${WORLD.posts[i].label.toUpperCase()} · ЗАКРЫТ`);
        lbl.setColor('#94a3b8');
        if (this._postSprites[i]) this._postSprites[i].setAlpha(0.16);
      } else if (post.broken) {
        lbl.setText(`${WORLD.posts[i].label.toUpperCase()} · АВАРИЯ`);
        lbl.setColor('#ef4444');
      } else if (post.busy) {
        lbl.setText(`${WORLD.posts[i].label.toUpperCase()} · МОЙКА`);
        if (this._postSprites[i]) this._postSprites[i].setAlpha(1);
        lbl.setColor('#22c55e');
      } else {
        lbl.setText(`${WORLD.posts[i].label.toUpperCase()} · ГОТОВ`);
        lbl.setColor('#38bdf8');
        if (this._postSprites[i]) this._postSprites[i].setAlpha(1);
      }
    }
  }

  _createPlayer() {
    this.player = this.physics.add.sprite(
      WORLD.playerStart.x,
      WORLD.playerStart.y,
      'player_idle'
    );
    this.player.setDepth(15);
    this.player.setScale(0.5);
    this.player.setCollideWorldBounds(true);
    // Body dimensions/offsets are doubled because the display scale is 0.5.
    this.player.body.setSize(48, 56);
    this.player.body.setOffset(18, 32);

    if (gameState.tutorialCompleted) {
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this._isCameraFollowingPlayer = true;
    }
  }

  _updateCameraTracking(immediate = false) {
    const cam = this.cameras.main;
    if (gameState.tutorialCompleted) {
      if (!this._isCameraFollowingPlayer && this.player) {
        this._isCameraFollowingPlayer = true;
        cam.startFollow(this.player, true, 0.1, 0.1);
      }
      return;
    }

    this._isCameraFollowingPlayer = false;
    cam.stopFollow();

    const post1 = WORLD.posts[0];
    let targetX = (this.player.x + post1.x) * 0.5;
    let targetY = (this.player.y + post1.y) * 0.5;

    if (this._isWashing) {
      targetX = post1.x;
      targetY = post1.y + 10;
    }

    if (immediate) {
      cam.centerOn(targetX, targetY);
    } else {
      const currentCenterX = cam.scrollX + (cam.width * 0.5) / cam.zoom;
      const currentCenterY = cam.scrollY + (cam.height * 0.5) / cam.zoom;
      const newX = Phaser.Math.Linear(currentCenterX, targetX, 0.08);
      const newY = Phaser.Math.Linear(currentCenterY, targetY, 0.08);
      cam.centerOn(newX, newY);
    }
  }

  _setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.interactKey.on('down', () => this._handleInteract());
    this.escKey.on('down', () => this._handleEscape());

    this._joystickActive = false;
    this._joystickVec = { x: 0, y: 0 };
    this._createMobileTouchControls();
  }

  _createMobileTouchControls() {
    const overlay = document.getElementById('ui-overlay');
    if (document.getElementById('mobile-controls-root')) return;

    const root = document.createElement('div');
    root.id = 'mobile-controls-root';
    root.className = 'mobile-controls';
    root.innerHTML = `
      <div class="joystick-zone" id="joystick-zone">
        <div class="joystick-base" id="joystick-base">
          <div class="joystick-stick" id="joystick-stick"></div>
        </div>
      </div>
      <div class="interact-btn-container">
        <button class="mobile-action-btn" id="mobile-action-btn">
          <span class="icon">🚿</span>
          <span class="main-text" id="action-btn-text">ДЕЙСТВИЕ</span>
          <span class="subtext" id="action-btn-sub">НАЖМИ [E]</span>
        </button>
      </div>
    `;
    overlay.appendChild(root);
    this._touchControlsRoot = root;

    const zone = document.getElementById('joystick-zone');
    const base = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    const actionBtn = document.getElementById('mobile-action-btn');

    // Пользовательская настройка меню действительно управляет видимостью джойстика.
    let joystickEnabled = true;
    try {
      joystickEnabled = localStorage.getItem('carwash_joystick_enabled') !== 'false';
    } catch (e) {
      // При запрещённом localStorage оставляем безопасное управление по умолчанию.
    }
    if (zone) zone.style.display = joystickEnabled ? '' : 'none';

    let touchId = null;

    const updateStick = (clientX, clientY) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxR = rect.width * 0.36;

      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }

      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      this._joystickVec.x = dx / maxR;
      this._joystickVec.y = dy / maxR;
      this._joystickActive = true;
    };

    const resetStick = () => {
      stick.style.transform = 'translate(0px, 0px)';
      this._joystickVec.x = 0;
      this._joystickVec.y = 0;
      this._joystickActive = false;
      touchId = null;
    };

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      touchId = t.identifier;
      updateStick(t.clientX, t.clientY);
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchId) {
          updateStick(t.clientX, t.clientY);
          break;
        }
      }
    }, { passive: false });

    zone.addEventListener('touchend', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          resetStick();
          break;
        }
      }
    });

    zone.addEventListener('touchcancel', resetStick);

    const triggerAction = (e) => {
      e.preventDefault();
      this._handleInteract();
    };

    actionBtn.addEventListener('touchstart', triggerAction, { passive: false });
    actionBtn.addEventListener('click', triggerAction);
  }

  _updateActionBtnContext() {
    const btnText = document.getElementById('action-btn-text');
    const btnSub = document.getElementById('action-btn-sub');
    if (!btnText || !btnSub) return;

    if (this._isWashing) {
      btnText.textContent = 'МОЙКА';
      btnSub.textContent = 'НАЖИМАЙ';
      return;
    }

    const coffeeDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, 816, 224);
    if (coffeeDistance < 108) {
      btnText.textContent = 'КОФЕ';
      btnSub.textContent = this._coffeeRushUntil > this.time.now ? 'КЛИЕНТЫ ЖДУТ' : 'ПОДДЕРЖАТЬ ОЧЕРЕДЬ';
      return;
    }

    // Show the office action before generic bay actions when the player reaches the entrance.
    const officeDistance = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, WORLD.building.x, WORLD.building.y + 68
    );
    if (officeDistance < 108) {
      btnText.textContent = 'ОФИС';
      btnSub.textContent = 'УПРАВЛЕНИЕ БИЗНЕСОМ';
      return;
    }

    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.unlocked === false) continue;
      if (post.broken) {
        const pos = WORLD.posts[i];
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
        if (dist < 100) {
          btnText.textContent = 'РЕМОНТ';
          btnSub.textContent = 'ПОЧИНИТЬ БОКС';
          return;
        }
      }
    }

    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.unlocked === false) continue;
      if (post.busy && post.carId) {
        const car = gameState.getCar(post.carId);
        if (car && !car.completed && !car.paid) {
          const pos = WORLD.posts[i];
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
          if (dist < 100) {
            btnText.textContent = 'НАЧАТЬ МОЙКУ';
            btnSub.textContent = 'ОБСЛУЖИТЬ АВТО';
            return;
          }
        }
      }
    }

    btnText.textContent = 'ДЕЙСТВИЕ';
    btnSub.textContent = 'ПОДОЙДИ БЛИЖЕ';
  }

  /** Отрисовка маркера подсветки целевого автомобиля во время обучения */
  _updateTargetHighlight() {
    this._targetHighlight.clear();
    if (gameState.tutorialCompleted) return;

    const post1 = gameState.posts[0];
    if (post1.busy && post1.carId) {
      const carSprite = this._carSprites[post1.carId];
      if (carSprite && carSprite.active) {
        const time = this.time.now * 0.005;
        const alpha = 0.6 + Math.sin(time) * 0.35;

        // 1. Неоновая рамка вокруг целевой машины
        this._targetHighlight.lineStyle(3, 0x00d2d3, alpha);
        this._targetHighlight.strokeRoundedRect(
          carSprite.x - carSprite.width / 2 - 6,
          carSprite.y - carSprite.height / 2 - 6,
          carSprite.width + 12,
          carSprite.height + 12,
          8
        );

        // 2. Анимированная стрелка над машиной
        const arrowY = carSprite.y - carSprite.height / 2 - 16 + Math.sin(time * 1.6) * 5;
        this._targetHighlight.fillStyle(0x00d2d3, 0.95);
        this._targetHighlight.fillTriangle(
          carSprite.x, arrowY + 8,
          carSprite.x - 7, arrowY,
          carSprite.x + 7, arrowY
        );

        // 3. Подложка бейджа «ЦЕЛЬ: БОКС 1»
        this._targetHighlight.fillStyle(0x0f172a, 0.9);
        this._targetHighlight.fillRoundedRect(carSprite.x - 48, arrowY - 20, 96, 18, 4);
        this._targetHighlight.lineStyle(1, 0x00d2d3, 0.7);
        this._targetHighlight.strokeRoundedRect(carSprite.x - 48, arrowY - 20, 96, 18, 4);
      }
    }
  }

  _handleInteract() {
    if (gameState.paused || !gameState.shiftActive) return;

    // Coffee Stop is a useful customer amenity: one interaction gives the queue
    // a short patience boost, so the neighbouring cafe has a clear gameplay role.
    const coffeeDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, 816, 224);
    if (!this._isWashing && coffeeDistance < 96) {
      this._coffeeRushUntil = this.time.now + 25000;
      audioManager.play('buttonClick');
      this._showCoffeeSteamBurst(816, 220);
      showToast('☕ Кофе готов! Клиенты в очереди подождут ещё 25 секунд.', 'success');
      return;
    }

    // Office entrance above the wash bays: open existing business management UI.
    // Reuse the current HUD action so finances/upgrades stay in one source of truth.
    const office = WORLD.building;
    const officeDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      office.x,
      office.y + 68
    );
    if (!this._isWashing && officeDistance < 92) {
      const businessButton = document.getElementById('hud-btn-business');
      if (businessButton && !businessButton.disabled) {
        businessButton.click();
      } else {
        showToast('Офис: открой «Бизнес» в верхнем меню управления.', 'info');
      }
      return;
    }

    if (this._isWashing) {
      audioManager.play('waterSpray');
      this._advanceWashStage();
      return;
    }

    // Ремонт бокса
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.broken) {
        const pos = WORLD.posts[i];
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
        if (dist < 100) {
          audioManager.play('wrenchRepair');
          this.player.setTexture('player_repair');
          this._spawnRepairSparks(pos.x, pos.y);
          this.time.delayedCall(450, () => {
            if (!this._isWashing && this.player) {
              this.player.setTexture('player_idle');
            }
          });
          const result = gameState.repairPost(post.id);
          if (result.success) {
            audioManager.play('success');
            this._postSprites[i].setTexture('wash-bay-art');
            showToast('Бокс успешно отремонтирован!', 'success');
            this._updatePostStatuses();
          } else {
            audioManager.play('error');
            showToast(result.reason, 'warning');
          }
          return;
        }
      }
    }

    // Мойка машины
    let nearestCarDist = Infinity;
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.busy && post.carId) {
        const car = gameState.getCar(post.carId);
        if (!car || car.completed || car.paid) continue;

        const pos = WORLD.posts[i];
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
        if (dist < nearestCarDist) nearestCarDist = dist;

        if (dist < 100) {
          this._startWashing(car.id);
          return;
        }
      }
    }

    if (nearestCarDist < 240) {
      showToast('Подойди ближе к машине в боксе!', 'info');
    } else {
      showToast('Нет машин поблизости. Подожди заезда в бокс!', 'info');
    }
  }

  _startWashing(carId) {
    const car = gameState.getCar(carId);
    if (!car || this._isWashing || car.completed) return;

    this._isWashing = true;
    this._washingCar = carId;
    car.washStage = 0;
    car.washProgress = 0;

    audioManager.startSpray('foam');
    this.player.setTexture('player_work');

    const stages = BALANCE.services.expressWash.stages;
    const stageName = BALANCE.services.expressWash.stageNames[stages[0]];
    showWashProgress(stageName, 0, 'Нажимай кнопку для нанесения пены!');

    if (!gameState.tutorialCompleted && gameState.tutorialStep === 1) {
      this._tutorialSystem.advance(1);
    }
  }

  _advanceWashStage() {
    const car = gameState.getCar(this._washingCar);
    if (!car) {
      this._stopWashing();
      return;
    }

    const stages = BALANCE.services.expressWash.stages;
    const isFoam = stages[car.washStage] === 'foam';
    audioManager.startSpray(isFoam ? 'foam' : 'water');
    audioManager.play(isFoam ? 'foamSpray' : 'rinse');

    if (car.washProgress < 100) {
      car.washProgress += 25;
      if (car.washProgress > 100) car.washProgress = 100;

      const stageName = BALANCE.services.expressWash.stageNames[stages[car.washStage]];
      showWashProgress(stageName, car.washProgress, car.washProgress >= 100 ? 'Этап готов! Нажми для перехода' : 'Продолжай мойку!');
      this._updateCarVisual(car);

      const sprite = this._carSprites[car.id];
      if (sprite) {
        this._spawnSplashBurst(sprite.x, sprite.y, isFoam);
      }

      if (car.washProgress >= 100) {
        if (car.washStage < stages.length - 1) {
          car.washStage++;
          car.washProgress = 0;
          const nextName = BALANCE.services.expressWash.stageNames[stages[car.washStage]];
          showWashProgress(nextName, 0, 'Нажимай кнопку действия!');
          this._updateCarVisual(car);
        } else {
          this._completeWash(car);
        }
      }
    } else {
      if (car.washStage < stages.length - 1) {
        car.washStage++;
        car.washProgress = 0;
        const nextName = BALANCE.services.expressWash.stageNames[stages[car.washStage]];
        showWashProgress(nextName, 0, 'Нажимай кнопку действия!');
        this._updateCarVisual(car);
      } else {
        this._completeWash(car);
      }
    }
  }

  _completeWash(car) {
    const qualityMult = gameState.getUpgradeEffect('equipmentQuality', 1);
    const quality = Math.min(1, 0.75 * qualityMult);

    car.quality = quality;
    car.state = 'done';
    car.completed = true;

    audioManager.stopSpray();
    if (this._sprayGfx) this._sprayGfx.clear();
    audioManager.play('cashRegister');
    const profit = gameState.addServiceIncome(car.id, quality);
    hideWashProgress();
    this._isWashing = false;
    this._washingCar = null;
    this.player.setTexture('player_idle');

    showToast(`Готово! Клиент оплатил +${this._formatMoney(profit)}`, 'success');
    this._showWashReward(car, profit, quality);
    this._updateCarVisual(car);

    const carSprite = this._carSprites[car.id];
    if (carSprite) {
      this._spawnCleanSparkles(carSprite.x, carSprite.y);
    }

    this.time.delayedCall(1400, () => {
      this._carLeave(car.id);
    });

    this._checkBreakdown(car.postId);

    if (!gameState.tutorialCompleted) {
      this._tutorialSystem.complete(profit);
    }

    updateHUD();
  }

  _stopWashing() {
    audioManager.stopSpray();
    if (this._sprayGfx) this._sprayGfx.clear();
    this._isWashing = false;
    this._washingCar = null;
    this.player.setTexture('player_idle');
    hideWashProgress();
  }

  _showWashReward(car, profit, quality) {
    const sprite = this._carSprites[car.id];
    if (!sprite || !sprite.active) return;
    const perfect = quality >= 0.85;
    const reward = this.add.container(sprite.x, sprite.y - 28).setDepth(40);
    const bg = this.add.graphics();
    bg.fillStyle(perfect ? 0x064e3b : 0x0b2238, 0.94);
    bg.lineStyle(2, perfect ? 0x34d399 : 0x38bdf8, 0.9);
    bg.fillRoundedRect(-65, -18, 130, 36, 12);
    bg.strokeRoundedRect(-65, -18, 130, 36, 12);
    const label = this.add.text(0, 0, (perfect ? '✦ ИДЕАЛЬНО  ' : '✓ ГОТОВО  ') + '+' + this._formatMoney(profit), {
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: perfect ? '#86efac' : '#a5f3fc', align: 'center',
      stroke: '#06111f', strokeThickness: 2,
    }).setOrigin(0.5);
    reward.add([bg, label]);
    this.tweens.add({ targets: reward, y: reward.y - 42, alpha: 0, duration: 1350, ease: 'Cubic.easeOut', onComplete: () => reward.destroy() });
    if (perfect) {
      const badge = this.add.text(sprite.x, sprite.y + 28, 'КАЧЕСТВО 85%+', {
        fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: '#86efac', backgroundColor: '#052e2b', padding: { x: 7, y: 4 },
      }).setOrigin(0.5).setDepth(40);
      this.tweens.add({ targets: badge, y: badge.y + 16, alpha: 0, delay: 300, duration: 900, onComplete: () => badge.destroy() });
    }
  }

  _showCoffeeSteamBurst(x, y) {
    const burst = this.add.particles(x, y, 'particle_mist', {
      speed: { min: 18, max: 48 }, angle: { min: 230, max: 310 },
      scale: { start: 0.6, end: 0 }, alpha: { start: 0.75, end: 0 },
      lifespan: 520, quantity: 8, tint: [0xffd7a0, 0xfff0d0], emitting: false,
    }).setDepth(30);
    burst.explode(8, x, y);
    this.time.delayedCall(650, () => { if (burst && burst.active) burst.destroy(); });
  }

  _checkBreakdown(postId) {
    if (!postId) return;
    const reliabilityMult = gameState.getUpgradeEffect('reliability', 1);
    const chance = BALANCE.breakdown.baseChancePerWash * reliabilityMult;
    if (Math.random() < chance) {
      const idx = gameState.posts.findIndex(p => p.id === postId);
      if (idx !== -1) {
        audioManager.play('warningBeep');
        gameState.breakPost(postId);
        this._postSprites[idx].setTexture('wash-bay-broken-art');
        showToast(`${WORLD.posts[idx].label} вышел из строя! Подойди для починки.`, 'warning');
      }
    }
  }

  _carLeave(carId) {
    const sprite = this._carSprites[carId];
    if (sprite) {
      audioManager.play('carDepart');
      this.tweens.killTweensOf(sprite);
      delete sprite._queueTargetX;
      sprite.setScale(0.5);
      this.tweens.add({
        targets: sprite,
        x: WORLD.exit.x + 80,
        y: WORLD.roadY,
        duration: 1200,
        ease: 'Power2',
        onComplete: () => {
          sprite.destroy();
          delete this._carSprites[carId];
        },
      });
    }
    for (const post of gameState.posts) {
      if (post.carId === carId) {
        post.busy = false;
        post.carId = null;
      }
    }
    gameState.removeCar(carId);
  }

  _spawnCar() {
    if (!gameState.shiftActive || gameState.paused) return;

    const demandMult = gameState.getDemandMultiplier();
    const maxQueue = gameState.getUpgradeEffect('capacity', BALANCE.customer.maxQueueSize);

    if (gameState.queue.length >= maxQueue) return;
    if (gameState.cars.length >= BALANCE.customer.maxActiveCars) return;

    const classes = Object.keys(BALANCE.carClasses);
    const weights = [0.25, 0.25, 0.18, 0.12, 0.12, 0.08];
    let r = Math.random();
    let classId = classes[0];
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) { classId = classes[i]; break; }
    }

    const car = gameState.addCar(classId);
    if (!car) return;

    audioManager.play('carArrive');
    const queueIndex = gameState.queue.indexOf(car.id);
    const targetX = WORLD.queueStart.x + queueIndex * WORLD.queueSpacing;
    const targetY = WORLD.queueStart.y;

    const sprite = this.add.image(WORLD.entrance.x - 30, WORLD.entrance.y, `car_${classId}_dirty`);
    sprite.setScale(0.5);
    sprite.setDepth(12 + WORLD.entrance.y * 0.01);
    sprite._queueTargetX = targetX;
    this._carSprites[car.id] = sprite;

    this.tweens.add({
      targets: sprite,
      x: targetX,
      y: targetY,
      duration: 1100,
      ease: 'Power2',
      onComplete: () => {
        if (sprite.active && sprite._queueTargetX === targetX) {
          sprite.setPosition(targetX, targetY);
        }
      },
    });
  }

  _moveCarToPost(carId, postIndex) {
    const postPos = WORLD.posts[postIndex];
    const sprite = this._carSprites[carId];
    if (!sprite) return;

    const postData = gameState.posts[postIndex];
    const assigned = gameState.assignCarToPost(carId, postData.id);
    if (!assigned) return;

    // IMPORTANT: cancel the old spawn/queue tween first. Otherwise Phaser runs
    // both tweens on x/y concurrently and the car stays at the entrance or disappears.
    this.tweens.killTweensOf(sprite);
    delete sprite._queueTargetX;
    sprite.setScale(0.54);
    sprite.setDepth(20 + postPos.y * 0.01);

    this.tweens.add({
      targets: sprite,
      x: postPos.x,
      y: postPos.y + 12,
      duration: 850,
      ease: 'Power2',
      onComplete: () => {
        if (sprite.active) {
          sprite.setPosition(postPos.x, postPos.y + 12);
          sprite.setDepth(20 + sprite.y * 0.01);
        }
      },
    });
  }

  _updateCarVisual(car) {
    const sprite = this._carSprites[car.id];
    if (!sprite) return;

    const stages = BALANCE.services.expressWash.stages;
    const stage = stages[car.washStage];

    let texKey;
    if (car.completed) {
      texKey = `car_${car.carClass}`;
    } else if (stage === 'foam') {
      texKey = car.washProgress > 30 ? `car_${car.carClass}_foam` : `car_${car.carClass}_dirty`;
    } else if (stage === 'rinse') {
      texKey = car.washProgress > 60 ? `car_${car.carClass}` : `car_${car.carClass}_rinse`;
    } else if (stage === 'finish') {
      texKey = `car_${car.carClass}`;
    } else {
      texKey = `car_${car.carClass}_dirty`;
    }

    if (this.textures.exists(texKey)) {
      sprite.setTexture(texKey);
    }
  }

  _processQueue() {
    for (let i = 0; i < gameState.posts.length; i++) {
      const post = gameState.posts[i];
      if (post.unlocked === false) continue;
      if (!post.busy && !post.broken && gameState.queue.length > 0) {
        const carId = gameState.queue[0];
        this._moveCarToPost(carId, i);
      }
    }

    for (let qi = 0; qi < gameState.queue.length; qi++) {
      const carId = gameState.queue[qi];
      const sprite = this._carSprites[carId];
      if (!sprite) continue;
      const targetX = WORLD.queueStart.x + qi * WORLD.queueSpacing;
      if (Math.abs(sprite.x - targetX) > 5 && sprite._queueTargetX !== targetX) {
        // Queue slots may shift after another vehicle leaves; retarget once only.
        this.tweens.killTweensOf(sprite);
        sprite._queueTargetX = targetX;
        this.tweens.add({
          targets: sprite,
          x: targetX,
          y: WORLD.queueStart.y,
          duration: 420,
          ease: 'Power2',
          onComplete: () => {
            if (sprite.active && sprite._queueTargetX === targetX) {
              sprite.setPosition(targetX, WORLD.queueStart.y);
            }
          },
        });
      }
    }
  }

  _updateQueueMood() {
    if (!this._queueMoodGfx) return;
    const gfx = this._queueMoodGfx;
    gfx.clear();
    const coffeeActive = this._coffeeRushUntil > this.time.now;
    for (const carId of gameState.queue) {
      const car = gameState.getCar(carId);
      const sprite = this._carSprites[carId];
      if (!car || !sprite || !sprite.active) continue;
      const patience = Math.max(1, Number(car.patience) || 1);
      const ratio = Phaser.Math.Clamp(1 - (car.waitTime || 0) / patience, 0, 1);
      const x = sprite.x - 18;
      const y = sprite.y - 27;
      const color = coffeeActive ? 0x34d399 : ratio < 0.25 ? 0xfb7185 : ratio < 0.5 ? 0xfbbf24 : 0x38bdf8;
      gfx.fillStyle(0x020817, 0.84);
      gfx.fillRoundedRect(x - 1, y - 1, 38, 7, 3);
      gfx.lineStyle(1, color, coffeeActive ? 0.8 : 0.42);
      gfx.strokeRoundedRect(x - 1, y - 1, 38, 7, 3);
      if (ratio > 0) {
        const alpha = ratio < 0.25 && !coffeeActive ? 0.62 + (Math.sin(this.time.now * 0.018) + 1) * 0.19 : 0.95;
        gfx.fillStyle(color, alpha);
        gfx.fillRoundedRect(x + 1, y + 1, Math.max(2, 34 * ratio), 3, 2);
      }
    }
  }

  _processPatience(delta) {
    // While the coffee amenity is active, queued customers pause their patience timer.
    if (this._coffeeRushUntil > this.time.now) return;
    const toRemove = [];
    for (const carId of gameState.queue) {
      const car = gameState.getCar(carId);
      if (!car) continue;
      car.waitTime += delta;
      if (car.waitTime >= car.patience) {
        toRemove.push(carId);
      }
    }

    for (const carId of toRemove) {
      showToast('Клиент устал ждать в очереди и уехал!', 'warning');
      gameState.changeReputation(BALANCE.reputation.missedCustomerPenalty);
      this._carLeave(carId);
    }
  }

  _processEmployees(delta) {
    // 1. Создание спрайтов для нанятых сотрудников
    for (let i = 0; i < gameState.employees.length; i++) {
      const emp = gameState.employees[i];
      if (!this._employeeSprites[emp.id]) {
        this._spawnEmployeeSprite(emp, i);
      }
    }

    // 2. Удаление спрайтов уволенных сотрудников
    for (const empId of Object.keys(this._employeeSprites)) {
      if (!gameState.employees.some(e => e.id === empId)) {
        const data = this._employeeSprites[empId];
        if (data && data.sprite && data.sprite.active) {
          data.sprite.setTexture('employee_walk_1');
          if (data.label) data.label.destroy();
          this.tweens.add({
            targets: data.sprite,
            x: WORLD.exit.x + 40,
            y: WORLD.roadY,
            alpha: 0,
            duration: 1100,
            ease: 'Power2',
            onComplete: () => {
              data.sprite.destroy();
            },
          });
        }
        delete this._employeeSprites[empId];
      }
    }

    // 3. Распределение задач для свободных сотрудников
    for (const emp of gameState.employees) {
      if (emp.status !== 'idle') continue;

      // Сначала проверка: есть ли сломанный бокс для ремонта техником?
      let foundTask = false;
      for (let i = 0; i < gameState.posts.length; i++) {
        const post = gameState.posts[i];
        if (post.broken && !this._isEmployeeRepairing(post.id)) {
          emp.status = 'repairing';
          emp.assignedPost = post.id;
          this._startEmployeeRepair(emp, i);
          foundTask = true;
          break;
        }
      }
      if (foundTask) continue;

      // Затем проверка: есть ли машина на мойке в свободном боксе?
      for (let i = 0; i < gameState.posts.length; i++) {
        const post = gameState.posts[i];
        if (post.busy && post.carId && !post.broken) {
          const car = gameState.getCar(post.carId);
          if (car && car.state === 'washing' && !car.completed && !this._isEmployeeAssigned(post.id)) {
            if (this._washingCar === car.id) continue;
            emp.status = 'working';
            emp.assignedPost = post.id;
            emp.assignedCar = car.id;
            this._startEmployeeWash(emp, car, i);
            break;
          }
        }
      }
    }
  }

  _isEmployeeAssigned(postId) {
    return gameState.employees.some(e => e.assignedPost === postId && e.status === 'working');
  }

  _isEmployeeRepairing(postId) {
    return gameState.employees.some(e => e.assignedPost === postId && e.status === 'repairing');
  }

  _getEmployeeRestPos(empId) {
    const idx = gameState.employees.findIndex(e => e.id === empId);
    const safeIdx = idx >= 0 ? idx : 0;
    return {
      x: WORLD.building.x - 70 + (safeIdx * 45),
      y: WORLD.building.y + 75,
    };
  }

  _spawnEmployeeSprite(emp, index) {
    const rest = this._getEmployeeRestPos(emp.id);
    const sprite = this.add.image(rest.x, rest.y, 'employee_idle').setDepth(14).setScale(0.5);

    const label = this.add.text(rest.x, rest.y - 32, emp.name, {
      fontSize: '10px',
      color: '#fef08a',
      fontStyle: 'bold',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(15);

    this._employeeSprites[emp.id] = { sprite, label, emp };
  }

  _startEmployeeRepair(emp, bayIndex) {
    const data = this._employeeSprites[emp.id];
    const postPos = WORLD.posts[bayIndex];
    const targetX = postPos.x - 30;
    const targetY = postPos.y + 16;

    if (data && data.sprite) {
      data.sprite.setTexture('employee_walk_1');
      this.tweens.add({
        targets: data.sprite,
        x: targetX,
        y: targetY,
        duration: 700,
        ease: 'Power1',
        onComplete: () => {
          if (this._destroyed || !data.sprite.active) return;
          data.sprite.setTexture('employee_repair');
          this._spawnRepairSparks(targetX, targetY);
          audioManager.play('wrenchRepair');

          this.time.delayedCall(2200, () => {
            if (this._destroyed) return;
            const post = gameState.posts[bayIndex];
            if (post && post.broken) {
              const res = gameState.repairPost(post.id);
              if (res.success) {
                this._postSprites[bayIndex].setTexture('wash-bay-art');
                showToast(`${emp.name} починил ${WORLD.posts[bayIndex].label}!`, 'success');
                audioManager.play('success');
                this._updatePostStatuses();
              }
            }
            emp.status = 'idle';
            emp.assignedPost = null;
            this._returnEmployeeToRest(emp);
          });
        },
      });
    }
  }

  _returnEmployeeToRest(emp) {
    const data = this._employeeSprites[emp.id];
    if (!data || !data.sprite || !data.sprite.active) return;
    const rest = this._getEmployeeRestPos(emp.id);

    data.sprite.setTexture('employee_walk_2');
    this.tweens.add({
      targets: data.sprite,
      x: rest.x,
      y: rest.y,
      duration: 800,
      ease: 'Power1',
      onComplete: () => {
        if (data.sprite.active) {
          data.sprite.setTexture('employee_idle');
        }
      },
    });
  }

  _startEmployeeWash(emp, car, bayIndex) {
    const stages = BALANCE.services.expressWash.stages;
    car.washStage = 0;
    car.washProgress = 0;

    const postPos = WORLD.posts[bayIndex];
    const targetX = postPos.x - 32;
    const targetY = postPos.y + 14;

    const empData = this._employeeSprites[emp.id];
    if (empData && empData.sprite) {
      empData.sprite.setTexture('employee_walk_1');
      this.tweens.add({
        targets: empData.sprite,
        x: targetX,
        y: targetY,
        duration: 650,
        ease: 'Power1',
        onComplete: () => {
          if (empData.sprite.active) {
            empData.sprite.setTexture('employee_work');
          }
        },
      });
    }

    const speedMult = gameState.getUpgradeEffect('washSpeed', 1);
    const carClass = BALANCE.carClasses[car.carClass];
    const totalTime = BALANCE.services.expressWash.baseDuration * stages.length *
      carClass.timeMultiplier * speedMult / emp.speed;

    const stageTime = totalTime / stages.length;
    let currentStage = 0;

    const advanceStage = () => {
      if (this._destroyed) return;
      const freshCar = gameState.getCar(car.id);
      if (!freshCar || freshCar.completed || freshCar.paid) {
        emp.status = 'idle';
        emp.assignedPost = null;
        emp.assignedCar = null;
        this._returnEmployeeToRest(emp);
        return;
      }

      freshCar.washStage = currentStage;
      freshCar.washProgress = 100;
      this._updateCarVisual(freshCar);

      const sprite = this._carSprites[freshCar.id];
      if (sprite) {
        const isFoam = stages[currentStage] === 'foam';
        this._spawnSplashBurst(sprite.x, sprite.y, isFoam);
        audioManager.play(isFoam ? 'foamSpray' : 'rinse');
      }

      currentStage++;
      if (currentStage >= stages.length) {
        const qualityMult = gameState.getUpgradeEffect('equipmentQuality', 1);
        const quality = Math.min(1, emp.quality * qualityMult);
        freshCar.quality = quality;
        freshCar.state = 'done';
        freshCar.completed = true;
        const profit = gameState.addServiceIncome(freshCar.id, quality);
        audioManager.play('cashRegister');
        this._updateCarVisual(freshCar);

        this.time.delayedCall(1400, () => {
          this._carLeave(freshCar.id);
        });

        this._checkBreakdown(freshCar.postId);

        emp.status = 'idle';
        emp.assignedPost = null;
        emp.assignedCar = null;
        this._returnEmployeeToRest(emp);
        updateHUD();
      } else {
        this._employeeTimers[emp.id] = this.time.delayedCall(stageTime, advanceStage);
      }
    };

    this._employeeTimers[emp.id] = this.time.delayedCall(stageTime, advanceStage);
  }

  _handleEscape() {
    const panels = document.querySelectorAll('.panel-overlay, .dialog-backdrop');
    if (panels.length > 0) {
      panels.forEach(p => p.remove());
      return;
    }

    gameState.paused = !gameState.paused;
    if (gameState.paused) {
      this.physics.pause();
      showToast('Пауза', 'info');
    } else {
      this.physics.resume();
      showToast('Продолжаем!', 'info');
    }
  }

  update(time, delta) {
    if (gameState.paused || !gameState.shiftActive) return;

    this._updatePlayerMovement(delta);

    this._spawnTimer += delta;
    const demandMult = gameState.getDemandMultiplier();
    const spawnInterval = (BALANCE.customer.spawnIntervalBase +
      (Math.random() * 2 - 1) * BALANCE.customer.spawnIntervalVariance) / demandMult;

    if (this._spawnTimer >= spawnInterval) {
      this._spawnTimer = 0;
      this._spawnCar();
    }

    this._processQueue();
    this._processPatience(delta);
    this._queueMoodUpdateTimer += delta;
    if (this._queueMoodUpdateTimer >= 180) {
      this._queueMoodUpdateTimer = 0;
      this._updateQueueMood();
    }
    this._processEmployees(delta);

    this._shiftTimer += delta;
    gameState.shiftTimeRemaining = Math.max(0, BALANCE.time.shiftDurationMs - this._shiftTimer);
    this._dayCycleUpdateTimer += delta;
    if (this._dayCycleUpdateTimer >= 100) {
      this._dayCycleUpdateTimer = 0;
      this._updateDayCycle();
    }

    this._updateCameraTracking(false);
    this._updateDepth();
    this._updateActionBtnContext();
    this._updateTargetHighlight(time);
    this._updateSprayEffect(time);
    this._updatePostStatuses();

    if (gameState.shiftTimeRemaining <= 0) {
      this.endShift();
      return;
    }

    if (Math.floor(time / 250) !== Math.floor((time - delta) / 250)) {
      updateHUD();
    }
  }

  _updatePlayerMovement(delta) {
    const speed = 190;
    let vx = 0, vy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vy = 1;

    if (this._joystickActive) {
      vx = this._joystickVec.x;
      vy = this._joystickVec.y;
    }

    const len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0) {
      vx = (vx / len) * speed;
      vy = (vy / len) * speed;

      this._walkAnimTimer += delta;
      if (this._walkAnimTimer > 170) {
        this._walkAnimTimer = 0;
        this._walkFrame = (this._walkFrame + 1) % 2;
        this.player.setTexture(this._walkFrame === 0 ? 'player_walk_1' : 'player_walk_2');
      }
    } else if (!this._isWashing) {
      this.player.setTexture('player_idle');
    }

    this.player.setVelocity(vx, vy);

    if (this._isWashing && this._washingCar) {
      const sprite = this._carSprites[this._washingCar];
      if (sprite) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);
        if (dist > 130) {
          this._stopWashing();
          showToast('Вы отошли от машины — мойка прервана', 'info');
        }
      }
    }

    if (!gameState.tutorialCompleted && gameState.tutorialStep === 0) {
      const pos = WORLD.posts[0];
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y);
      if (dist < 115) {
        this._tutorialSystem.advance(0);
      }
    }
  }

  _updateDepth() {
    this.player.setDepth(15 + this.player.y * 0.01);
    for (const carId of Object.keys(this._carSprites)) {
      const sprite = this._carSprites[carId];
      if (sprite && sprite.active) {
        // Машина гарантированно поверх пола (6) и ниже игрока (15)
        sprite.setDepth(10 + sprite.y * 0.01);
      }
    }
    for (const empId of Object.keys(this._employeeSprites)) {
      const data = this._employeeSprites[empId];
      if (data && data.sprite && data.sprite.active) {
        data.sprite.setDepth(14 + data.sprite.y * 0.01);
        if (data.label && data.label.active) {
          data.label.setDepth(16 + data.sprite.y * 0.01);
          data.label.setPosition(data.sprite.x, data.sprite.y - 32);
        }
      }
    }
  }

  endShift() {
    if (gameState.shiftEndProcessing) return;
    gameState.shiftEndProcessing = true;
    gameState.shiftActive = false;
    gameState.shiftTimeRemaining = 0;
    updateHUD();

    this._stopWashing();

    for (const timerId of Object.keys(this._employeeTimers)) {
      if (this._employeeTimers[timerId]) {
        this._employeeTimers[timerId].remove(false);
      }
    }
    this._employeeTimers = {};

    for (const emp of gameState.employees) {
      emp.status = 'idle';
      emp.assignedPost = null;
      emp.assignedCar = null;
    }

    for (const empId of Object.keys(this._employeeSprites)) {
      const data = this._employeeSprites[empId];
      if (data && data.sprite && data.sprite.active) {
        data.sprite.setTexture('employee_idle');
        const rest = this._getEmployeeRestPos(empId);
        data.sprite.setPosition(rest.x, rest.y);
        if (data.label && data.label.active) {
          data.label.setPosition(rest.x, rest.y - 32);
        }
      }
    }

    const remainingCars = [...gameState.cars];
    for (const car of remainingCars) {
      if (!car.completed) {
        gameState.changeReputation(BALANCE.reputation.missedCustomerPenalty);
      }
      const sprite = this._carSprites[car.id];
      if (sprite) {
        sprite.destroy();
        delete this._carSprites[car.id];
      }
    }
    gameState.cars = [];
    gameState.queue = [];
    if (this._queueMoodGfx) this._queueMoodGfx.clear();

    for (const post of gameState.posts) {
      post.busy = false;
      post.carId = null;
    }

    // Применение суточных расходов
    gameState.applyDailyExpenses();

    // Проверка надзорных инспекций (СЭС, МЧС, Экология)
    const inspResult = gameState.checkInspections();

    saveSystem.save();
    this._storySystem.checkEvents(this);
    this._showDayReport(inspResult);

    gameState.shiftEndProcessing = false;
  }

  _showDayReport(inspResult = null) {
    const overlay = document.getElementById('ui-overlay');
    const todayLogs = gameState.financialLog.filter(l => l.day === gameState.day);
    const income = todayLogs.filter(l => l.type === 'income').reduce((s, l) => s + l.amount, 0);
    const expenses = todayLogs.filter(l => l.type === 'expense').reduce((s, l) => s + l.amount, 0);
    const profit = income - expenses;

    const unlockedToday = todayLogs.filter(log => log.type === 'income' && log.description.startsWith('Достижение:'));

    let rows = '';
    for (const log of todayLogs) {
      const cls = log.type === 'income' ? 'income' : 'expense';
      const sign = log.type === 'income' ? '+' : '-';
      rows += `<tr class="${cls}"><td>${log.description}</td><td>${sign}${this._formatMoney(log.amount)}</td></tr>`;
    }

    let inspectionNotice = '';
    if (inspResult) {
      if (inspResult.passed) {
        inspectionNotice = `
          <div style="background:rgba(34,197,94,0.12);border:1px solid #22c55e;border-radius:8px;padding:8px;margin:8px 0;font-size:12px;color:#86efac;">
            ✓ <strong>${inspResult.insp.name}</strong> пройдена успешно! Репутация повышена (+5).
          </div>
        `;
      } else {
        inspectionNotice = `
          <div style="background:rgba(239,68,68,0.15);border:1px solid #ef4444;border-radius:8px;padding:8px;margin:8px 0;font-size:12px;color:#fca5a5;">
            ⚠️ <strong>${inspResult.insp.name}:</strong> Выявлено нарушение! Отсутствует ${inspResult.docDef.name}. Наложен штраф <strong>${this._formatMoney(inspResult.fine)}</strong>. Оформите документ в разделе «Бизнес».
          </div>
        `;
      }
    }

    const panel = document.createElement('div');
    panel.className = 'panel-overlay';
    panel.innerHTML = `
      <div class="panel">
        <button class="panel-close" id="report-close">✕</button>
        <h2>Итоги смены ${gameState.day}</h2>
        ${inspectionNotice}
        <table class="finance-table">
          ${rows}
          <tr class="total">
            <td>Прибыль за смену</td>
            <td style="color:${profit >= 0 ? '#22c55e' : '#ef4444'}">${profit >= 0 ? '+' : ''}${this._formatMoney(profit)}</td>
          </tr>
        </table>
        <div class="shift-report-metrics">
          <div><span>АВТО ЗА СМЕНУ</span><strong>${gameState.stats.todayCarsWashed}</strong></div>
          <div><span>ИДЕАЛЬНЫЕ МОЙКИ</span><strong>${gameState.stats.todayPerfectWashes}</strong></div>
          <div><span>РЕПУТАЦИЯ</span><strong>${Math.round(gameState.reputation)} / 100</strong></div>
        </div>
        ${unlockedToday.length ? `<div class="shift-report-achievements"><strong>🏆 Новые достижения</strong><span>${unlockedToday.map(log => log.description.replace('Достижение: ', '')).join(' · ')}</span></div>` : ''}
        <p style="color:#cbd5e1;font-size:12px;">Баланс кассы: <strong style="color:#38bdf8">${this._formatMoney(gameState.money)}</strong></p>
        ${gameState.money < 0 ? '<p style="color:#ef4444;font-weight:bold;margin-top:6px;font-size:12px;">⚠ Баланс ушел в минус! Оптимизируйте расходы.</p>' : ''}
        <div style="text-align:center;margin-top:14px;">
          <button class="game-btn primary" id="next-day-btn" style="width:100%;">Начать следующий рабочий день</button>
        </div>
      </div>
    `;
    overlay.appendChild(panel);

    document.getElementById('report-close').addEventListener('click', () => panel.remove());
    document.getElementById('next-day-btn').addEventListener('click', () => {
      panel.remove();
      this._startNextDay();
    });

    if (!gameState.tutorialCompleted) {
      this._tutorialSystem.complete();
    }
  }

  _startNextDay() {
    gameState.nextDay();
    this._shiftTimer = 0;
    this._spawnTimer = 0;
    this._dayCycleUpdateTimer = 0;
    this._updateDayCycle();
    this._storySystem.checkEvents(this);
    updateHUD();
    saveSystem.save();
  }

  _updateSprayEffect(time) {
    if (!this._sprayGfx) return;
    this._sprayGfx.clear();

    if (!this._isWashing || !this._washingCar) return;

    const car = gameState.getCar(this._washingCar);
    const sprite = this._carSprites[this._washingCar];
    if (!car || !sprite) return;

    const stages = BALANCE.services.expressWash.stages;
    const currentStage = stages[car.washStage] || 'foam';

    const pX = this.player.x + 14;
    const pY = this.player.y - 6;

    const t = (time || 0) * 0.006;
    const targetX = sprite.x + Math.sin(t * 3) * 16;
    const targetY = sprite.y + Math.cos(t * 4) * 8;

    const isFoam = currentStage === 'foam';
    const sprayColor = isFoam ? 0xffffff : 0x38bdf8;
    const sprayAlpha = isFoam ? 0.8 : 0.65;

    // Струя воды/пены под высоким давлением (конус)
    this._sprayGfx.lineStyle(3, sprayColor, sprayAlpha);
    this._sprayGfx.lineBetween(pX, pY, targetX, targetY);

    this._sprayGfx.lineStyle(1.5, sprayColor, sprayAlpha * 0.45);
    this._sprayGfx.lineBetween(pX, pY, targetX - 10, targetY - 6);
    this._sprayGfx.lineBetween(pX, pY, targetX + 10, targetY + 6);

    // Пятно контакта и водяная пыль
    this._sprayGfx.fillStyle(sprayColor, 0.85);
    this._sprayGfx.fillCircle(targetX, targetY, isFoam ? 9 : 6);
    this._sprayGfx.fillStyle(0xffffff, 0.4);
    this._sprayGfx.fillCircle(targetX, targetY, isFoam ? 16 : 11);
  }

  _spawnSplashBurst(x, y, isFoam = false) {
    const tex = isFoam ? 'particle_foam' : 'particle_water';
    for (let i = 0; i < 7; i++) {
      const p = this.add.image(x, y, tex).setDepth(23);
      const angle = (Math.PI * 2 * i) / 7 + (Math.random() - 0.5) * 0.5;
      const speed = 25 + Math.random() * 35;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        scale: { from: 1, to: 0.2 },
        alpha: { from: 1, to: 0 },
        duration: 320 + Math.random() * 120,
        ease: 'Power1',
        onComplete: () => p.destroy(),
      });
    }
  }

  _spawnCleanSparkles(x, y) {
    const offsets = [
      { dx: -35, dy: -14 },
      { dx: 30, dy: -12 },
      { dx: -20, dy: 16 },
      { dx: 25, dy: 14 },
    ];
    for (let i = 0; i < offsets.length; i++) {
      this.time.delayedCall(i * 120, () => {
        const off = offsets[i];
        const star = this.add.text(x + off.dx, y + off.dy, '✦', {
          fontSize: '18px',
          color: '#fef08a',
          fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(24);

        this.tweens.add({
          targets: star,
          scale: { from: 0.3, to: 1.4 },
          alpha: { from: 1, to: 0 },
          y: y + off.dy - 12,
          duration: 500,
          ease: 'Back.easeOut',
          onComplete: () => star.destroy(),
        });
      });
    }
  }

  _spawnRepairSparks(x, y) {
    for (let i = 0; i < 9; i++) {
      const spark = this.add.rectangle(x, y - 20, 3, 3, i % 2 === 0 ? 0xf59e0b : 0xef4444);
      spark.setDepth(23);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 20 + Math.random() * 30;
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * speed,
        y: y - 20 + Math.sin(angle) * speed,
        alpha: { from: 1, to: 0 },
        duration: 250 + Math.random() * 150,
        onComplete: () => spark.destroy(),
      });
    }
  }

  _formatMoney(amount) {
    if (typeof amount !== 'number' || !isFinite(amount)) return '0 ₽';
    return amount.toLocaleString('ru-RU') + ' ₽';
  }

  shutdown() {
    this._destroyed = true;
    this._stopWashing();
    audioManager.stopSpray();
    this.scale.off('resize', this._handleResize, this);
    saveSystem.stopAutoSave();
    gameState.off('stateChanged', this._onStateChanged);
    gameState.off('achievementUnlocked', this._onAchievementUnlocked);
    destroyHUD();
    hideWashProgress();

    if (this._targetHighlight) {
      this._targetHighlight.destroy();
    }

    if (this._sprayGfx) {
      this._sprayGfx.destroy();
    }
    if (this._queueMoodGfx) {
      this._queueMoodGfx.destroy();
      this._queueMoodGfx = null;
    }

    if (this._touchControlsRoot) {
      this._touchControlsRoot.remove();
      this._touchControlsRoot = null;
    }

    for (const empId of Object.keys(this._employeeSprites)) {
      const data = this._employeeSprites[empId];
      if (data) {
        if (data.sprite) data.sprite.destroy();
        if (data.label) data.label.destroy();
      }
    }
    this._employeeSprites = {};

    for (const timerId of Object.keys(this._employeeTimers)) {
      if (this._employeeTimers[timerId]) {
        this._employeeTimers[timerId].remove(false);
      }
    }
  }
}
