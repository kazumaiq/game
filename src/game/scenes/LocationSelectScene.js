/**
 * LocationSelectScene — выбор параметров старта и передача в GameState.
 */
import gameState from '../systems/GameState.js';
import BALANCE from '../config/balance.js';
import { showLocationSelect, hideLocationSelect } from '../../ui/LocationSelectUI.js';

export default class LocationSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LocationSelectScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0e14');

    showLocationSelect({
      locations: BALANCE.locations,
      startupCosts: BALANCE.startupCosts,
      totalStartupCost: BALANCE.totalStartupCost,
      startingCapital: BALANCE.startingCapital,
      onSelect: (locationId, customConfig) => {
        hideLocationSelect();
        gameState.initNewGame(locationId, customConfig);
        this.scene.start('CarWashScene');
      },
    });
  }

  shutdown() {
    hideLocationSelect();
  }
}
