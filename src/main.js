/**
 * main.js — точка входа клиентского приложения.
 */
import { createGame } from './game/createGame.js';
import { audioManager } from './game/systems/AudioManager.js';

window.addEventListener('DOMContentLoaded', () => {
  window.__phaserGame = createGame();
  window.__audioManager = audioManager;
});
