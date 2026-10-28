/**
 * AudioManager — процедурная аудиосистема на Web Audio API.
 * Генерирует звуковые эффекты без внешних аудиофайлов.
 * Поддерживает автозапуск после первого взаимодействия (iOS/Chrome),
 * регулировку громкости и полное отключение звука.
 */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.masterVolume = 0.5;
    this.sfxEnabled = true;
    this._initialized = false;
    this._activeSpray = null;
    this._lastPlayTimes = {};

    // Восстанавливаем настройки из localStorage если есть
    try {
      const savedVol = localStorage.getItem('carwash_volume');
      if (savedVol !== null) this.masterVolume = parseFloat(savedVol);
      const savedSfx = localStorage.getItem('carwash_sfx');
      if (savedSfx !== null) this.sfxEnabled = savedSfx === 'true';
    } catch (e) {
      // Игнорируем ошибки доступа к localStorage
    }
  }

  /** Инициализация AudioContext по первому клику/тапу пользователя */
  ensureContext() {
    if (typeof window === 'undefined') return;
    if (this._initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.sfxEnabled ? this.masterVolume : 0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this._initialized = true;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (err) {
      console.warn('AudioContext init error:', err);
    }
  }

  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    try {
      localStorage.setItem('carwash_volume', this.masterVolume.toString());
    } catch (e) {}

    if (this.masterGain && this.ctx) {
      const targetGain = this.sfxEnabled ? this.masterVolume : 0;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
  }

  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    try {
      localStorage.setItem('carwash_sfx', this.sfxEnabled.toString());
    } catch (e) {}

    if (this.masterGain && this.ctx) {
      const targetGain = this.sfxEnabled ? this.masterVolume : 0;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    return this.sfxEnabled;
  }

  play(soundName) {
    if (!this.sfxEnabled || this.masterVolume <= 0) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    // Защита от спама звуками (не чаще одного раза в 70мс для одинакового звука)
    const now = Date.now();
    if (this._lastPlayTimes[soundName] && now - this._lastPlayTimes[soundName] < 70) {
      return;
    }
    this._lastPlayTimes[soundName] = now;

    try {
      switch (soundName) {
        case 'buttonClick':
          this._playButtonClick();
          break;
        case 'waterSpray':
          this._playWaterSpray();
          break;
        case 'foamSpray':
          this._playFoamSpray();
          break;
        case 'rinse':
          this._playRinse();
          break;
        case 'cashRegister':
          this._playCashRegister();
          break;
        case 'warningBeep':
          this._playWarningBeep();
          break;
        case 'wrenchRepair':
          this._playWrenchRepair();
          break;
        case 'carArrive':
          this._playCarArrive();
          break;
        case 'carDepart':
          this._playCarDepart();
          break;
        case 'success':
          this._playSuccess();
          break;
        case 'error':
          this._playError();
          break;
        default:
          this._playButtonClick();
      }
    } catch (e) {
      // Аудио не должно ломать логику игры
    }
  }

  /** Запуск непрерывного звука струи мойки (пена или вода) */
  startSpray(type = 'water') {
    if (!this.sfxEnabled || this.masterVolume <= 0) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;

    const freq = type === 'foam' ? 750 : 1350;
    const q = type === 'foam' ? 1.2 : 1.9;

    // Если струя уже играет, просто плавно модулируем фильтр
    if (this._activeSpray) {
      try {
        this._activeSpray.filter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.08);
        this._activeSpray.filter.Q.setTargetAtTime(q, this.ctx.currentTime, 0.08);
      } catch (e) {}
      return;
    }

    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 1.0);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, this.ctx.currentTime);
      filter.Q.setValueAtTime(q, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.06);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(t);
      this._activeSpray = { noise, filter, gain };
    } catch (e) {}
  }

  /** Плавная остановка звука струи мойки */
  stopSpray() {
    if (!this._activeSpray || !this.ctx) return;
    try {
      const { noise, gain } = this._activeSpray;
      const t = this.ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      setTimeout(() => {
        try { noise.stop(); } catch (e) {}
      }, 100);
    } catch (e) {}
    this._activeSpray = null;
  }

  /** Короткий клик кнопки интерфейса (чистый синус, 50мс) */
  _playButtonClick() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.05);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  /** Шум струи воды высокого давления (фильтрованный белый шум) */
  _playWaterSpray() {
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 1.8;

    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start(t);
  }

  /** Звук активной пены (низкочастотный шум с пульсацией) */
  _playFoamSpray() {
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.35);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(350, this.ctx.currentTime + 0.35);

    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
  }

  /** Звук смывания (свист потока воды) */
  _playRinse() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(900, t + 0.15);
    osc.frequency.linearRampToValueAtTime(250, t + 0.35);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.35);
  }

  /** Звон кассы при получении денег («дзынь» + монеты) */
  _playCashRegister() {
    const t = this.ctx.currentTime;

    // Первый колокольчик
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046, t); // C6
    gain1.gain.setValueAtTime(0.25, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.25);

    // Второй высокий колокольчик
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1567, t + 0.08); // G6
    gain2.gain.setValueAtTime(0.3, t + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(t + 0.08);
    osc2.stop(t + 0.35);
  }

  /** Звук аварии / поломки (двойной тревожный сигнал) */
  _playWarningBeep() {
    const t = this.ctx.currentTime;

    const beep = (startTime) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(580, startTime);
      gain.gain.setValueAtTime(0.22, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.12);
    };

    beep(t);
    beep(t + 0.16);
  }

  /** Звук ремонта гаечным ключом (металлические удары) */
  _playWrenchRepair() {
    const t = this.ctx.currentTime;

    const clank = (startTime, freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, startTime + 0.08);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.09);
    };

    clank(t, 950);
    clank(t + 0.12, 1200);
    clank(t + 0.22, 800);
  }

  /** Звук подъезжающего автомобиля (низкий гул мотора) */
  _playCarArrive() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.linearRampToValueAtTime(130, t + 0.25);
    osc.frequency.linearRampToValueAtTime(80, t + 0.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  /** Звук уезжающего автомобиля */
  _playCarDepart() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.4);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, t);

    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  /** Аккорд успеха */
  _playSuccess() {
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const t = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = t + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(start);
      osc.stop(start + 0.28);
    });
  }

  /** Звук ошибки */
  _playError() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'square';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.setValueAtTime(110, t + 0.1);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.22);
  }
}

export const audioManager = new AudioManager();
export default audioManager;
