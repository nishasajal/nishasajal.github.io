import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../email/SheetSync.gs', import.meta.url), 'utf8');
function worker(overrides = {}) {
  const context = vm.createContext({ console: { log() {} }, ...overrides });
  vm.runInContext(source, context);
  return context;
}
function snapshot(guests = [guest()]) {
  return { generated_at: '2026-10-17T12:00:00Z', guests_count: guests.length,
    submissions_count: new Set(guests.map(g => g.submission_id)).size, guests };
}
function guest(overrides = {}) {
  return { guest_id: 'guest-1', submission_id: 'party-1', guest_order: 1, full_name: 'Example Guest',
    attending: true, events: ['haldi', 'wedding'], primary_name: 'Example Guest',
    contact_email: 'guest@example.invalid', song_request: 'A song', email_status: 'sent',
    created_at: '2026-10-01T12:00:00Z', email_sent_at: '2026-10-01T12:01:00Z', ...overrides };
}

test('exports each guest and their event choices, including declines, with typed dates', () => {
  const ctx = worker();
  const rows = ctx.weddingSheetRows_(snapshot([guest(), guest({ guest_id: 'guest-2', guest_order: 2,
    full_name: 'Second Guest', attending: false, events: [], email_sent_at: null })]));
  assert.equal(rows.length, 2);
  assert.deepEqual(Array.from(rows[0].slice(1, 5)), ['Attending', 'Yes', '', 'Yes']);
  assert.deepEqual(Array.from(rows[1].slice(1, 5)), ['Unable to attend', '', '', '']);
  assert.equal(rows[0][9].toISOString(), '2026-10-01T12:00:00.000Z');
  assert.equal(rows[1][10], '');
  assert.equal(rows[1][13], 2);
});

test('guest names, song requests and contact fields cannot become spreadsheet formulas', () => {
  const ctx = worker();
  for (const value of ['=HYPERLINK("https://example.invalid")', ' \n=1+1', '+123', '-1', '@SUM(A1)', "'literal"]) {
    const rows = ctx.weddingSheetRows_(snapshot([guest({ full_name: value, song_request: value,
      contact_email: value, primary_name: value })]));
    for (const col of [0, 5, 6, 7]) assert.equal(rows[0][col], "'" + value);
  }
  assert.equal(ctx.weddingSheetText_('O Sajni Re'), 'O Sajni Re');
});

test('rejects incomplete snapshots, duplicate identities and invalid attendance before writing', () => {
  const ctx = worker();
  const bad = [null, {}, { ...snapshot(), guests_count: 2 }, { ...snapshot(), submissions_count: 2 },
    snapshot([guest(), guest()]), snapshot([guest({ guest_order: 2 })]),
    snapshot([guest({ attending: false })]), snapshot([guest({ events: ['unknown'] })]),
    snapshot([guest({ created_at: 'bad date' })])];
  for (const data of bad) assert.throws(() => ctx.weddingSheetRows_(data));
  assert.equal(ctx.weddingSheetRows_(snapshot([])).length, 0);
});

test('handles a full snapshot beyond the default REST row limit', () => {
  const ctx = worker();
  const data = snapshot(Array.from({ length: 1200 }, (_, i) => guest({ guest_id: 'g-' + i, submission_id: 'r-' + i })));
  assert.equal(ctx.weddingSheetRows_(data).length, 1200);
});

test('failed reads preserve guest data and last successful timestamp, without sending email', () => {
  let writes = [], calls = [], releases = 0;
  const summary = { getRange: cell => ({ setValue: value => writes.push([cell, value]) }) };
  const ctx = worker({
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'existing-sheet' }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => releases++ }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: name => name === 'Summary' ? summary : assert.fail('Touched guest data') }) },
    weddingRpc_: (name) => { calls.push(name); throw new Error('Service unavailable'); },
  });
  assert.throws(() => ctx.syncWeddingRsvpsToSheet(), /refresh failed/);
  assert.deepEqual(calls, ['export_nisha_sajal_rsvps']);
  assert.equal(writes.length, 1); assert.equal(writes[0][0], 'B5');
  assert.equal(releases, 1);
});

test('setup reuses the private spreadsheet and does not duplicate an existing trigger', () => {
  const ctx = worker({
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'existing-sheet' }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    SpreadsheetApp: { openById: id => { assert.equal(id, 'existing-sheet'); return { getUrl: () => 'private-sheet' }; },
      create: () => assert.fail('Created duplicate Sheet') },
    ScriptApp: { getProjectTriggers: () => [{ getHandlerFunction: () => 'syncWeddingRsvpsToSheet' }],
      newTrigger: () => assert.fail('Created duplicate trigger') },
    weddingRpc_: name => { assert.equal(name, 'export_nisha_sajal_rsvps'); return snapshot(); },
  });
  ctx.weddingSheetLayout_ = () => {};
  ctx.weddingWriteSnapshot_ = () => {};
  ctx.installWeddingSheetSync();
});
