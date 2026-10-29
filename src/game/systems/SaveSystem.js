/**
 * SaveSystem — сохранение/загрузка через LocalStorage.
 * Версионированная схема с обработкой ошибок.
 */
import gameState from './GameState.js';

const SAVE_KEY = 'carwash_save_v3';
const AUTO_SAVE_INTERVAL = 30_000;

class SaveSystem {
  constructor() {
    this._autoSaveTimer = null;
  }

  save() {
    try {
      const data = gameState.serialize();
      const json = JSON.stringify(data);
      localStorage.setItem(SAVE_KEY, json);
      return true;
    } catch (e) {
      console.error('SaveSystem: save failed', e);
      return false;
    }
  }

  load() {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (!json) return { success: false, reason: 'noSave' };
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object' || !data.saveVersion) {
        return { success: false, reason: 'corrupt' };
      }
      const ok = gameState.deserialize(data);
      if (!ok) return { success: false, reason: 'corrupt' };
      return { success: true };
    } catch (e) {
      console.error('SaveSystem: load failed', e);
      return { success: false, reason: 'corrupt' };
    }
  }

  hasSave() {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (!json) return false;
      const data = JSON.parse(json);
      return data && data.saveVersion && data.initialized;
    } catch {
      return false;
    }
  }

  getSaveSummary() {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (!json) return null;
      const data = JSON.parse(json);
      if (!data || !data.saveVersion || !data.initialized) return null;
      return {
        day: Number.isFinite(data.day) ? Math.max(1, Math.floor(data.day)) : 1,
        money: Number.isFinite(data.money) ? data.money : 0,
        reputation: Number.isFinite(data.reputation) ? Math.max(0, Math.min(100, data.reputation)) : 50,
      };
    } catch {
      return null;
    }
  }

  deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  startAutoSave() {
    this.stopAutoSave();
    this._autoSaveTimer = setInterval(() => {
      if (gameState.initialized && gameState.shiftActive) {
        this.save();
      }
    }, AUTO_SAVE_INTERVAL);
  }

  stopAutoSave() {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
  }
}

export const saveSystem = new SaveSystem();
export default saveSystem;
