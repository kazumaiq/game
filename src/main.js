/**
 * main.js — точка входа клиентского приложения.
 */
import { createGame } from './game/createGame.js';

window.addEventListener('DOMContentLoaded', () => {
  createGame();
});
