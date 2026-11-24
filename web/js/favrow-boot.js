// MedBilling Logs: load the shared favourites component and suite chrome, expose them to the classic scripts (same pattern as rowfmt-boot.js)
import * as FR from './shared/favrow.js';
import * as SUITE from './shared/suite.js';
window.MBFavRow = FR;
window.MBSuite = SUITE;
SUITE.syncBar(document.getElementById('tabs'));
requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));   // the Today grid re-fits above the bar
document.dispatchEvent(new Event('mbfavrow'));
