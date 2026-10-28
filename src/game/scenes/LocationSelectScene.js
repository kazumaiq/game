/**
 * LocationSelectScene — выбор начальной локации.
 */
import gameState from '../systems/GameState.js';
import BALANCE from '../config/balance.js';
import { showLocationSelect, hideLocationSelect } from '../../ui/LocationSelectUI.js';

export default class LocationSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LocationSelectScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    showLocationSelect({
      locations: BALANCE.locations,
      startupCosts: BALANCE.startupCosts,
      totalStartupCost: BALANCE.totalStartupCost,
      startingCapital: BALANCE.startingCapital,
      onSelect: (locationId) => {
        hideLocationSelect();
        gameState.initNewGame(locationId);
        this.scene.start('CarWashScene');
      },
    });
  }

  shutdown() {
    hideLocationSelect();
  }
}
