// MedBilling Logs: load Fee Desk's shared code-row formatter (vendored, byte-identical, in js/shared/)
// and expose it to the classic scripts. app.js renders a plain fallback until 'mbrowfmt' fires, then re-renders.
import * as F from './shared/rowfmt.js';
import { SHORT_NAMES } from './shared/short-names.js';
window.MBRowFmt = Object.assign({}, F, { SHORT_NAMES });
document.dispatchEvent(new Event('mbrowfmt'));
