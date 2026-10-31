// Ontario (licence C/N 0198/26/N) parity checks for MedBilling Logs. Run: node --test tests/ontario-data.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const J = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')), T = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const LEGEND = "© King's Printer for Ontario, 2026. Reproduced with permission.";
const ON = J('site/data/codes-ON.json'), IDX = J('site/data/codes-index.json'), card = IDX.list.find(x => x.id === 'ON');
test('ON list is live, credit carries the verbatim legend for each licensed work and the disclaimer', () => {
  assert.ok(!card.held); assert.equal(card.n, ON.codes.length); assert.equal(ON.codes.length, 5340);
  for (const c of [ON.meta.credit, card.credit]) {
    assert.equal(c.split(LEGEND).length - 1, 2);
    assert.match(c, /Schedule of Benefits for Physician Services \(effective July 1, 2026\): ©/); assert.match(c, /OHIP Physician Fee Schedule Master: ©/);
    assert.match(c, /no representation about the accuracy, completeness or currency of this material or its fitness for any particular purpose/);
  }
});
test('no personal name, title or email; codes valid and unique; amounts as printed', () => {
  assert.doesNotMatch(JSON.stringify(ON) + JSON.stringify(card), /Dr\.|@|gmail|0198/i);
  const seen = new Set(); for (const [c, d, fee] of ON.codes) { assert.match(c, /^[A-Z]\d{3}[A-Z]?$/); assert.ok(!seen.has(c)); seen.add(c); assert.ok(d); assert.ok(/^\$[\d,]+\.\d\d$|^PRO |^TEC |^See schedule$/.test(fee), c + fee); }
  const R = Object.fromEntries(ON.codes.map(r => [r[0], r])); assert.equal(R.A001[2], '$26.80'); assert.equal(R.J902[2], 'PRO $51.00 · TEC $90.40');
});
test('sw caches the ON list; about text carries the legend; other held provinces stay held', () => {
  assert.match(T('site/sw.js'), /data\/codes-ON\.json/); assert.ok(T('site/index.html').includes("© King&#39;s Printer for Ontario, 2026. Reproduced with permission."));
  for (const id of ['BC', 'QC', 'PE', 'NB']) assert.ok(!IDX.list.find(x => x.id === id && !x.held));
  assert.ok(IDX.list.find(x => x.id === 'NS').held);
});
