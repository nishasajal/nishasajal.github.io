// Private Supabase -> Google Sheets mirror. Add beside Code.gs, never as a web app.
// Run installWeddingSheetSync once; it safely reuses its Sheet and trigger on retry.
var WEDDING_SHEET_ID_PROPERTY = 'WEDDING_RSVP_SHEET_ID';
var WEDDING_SHEET_HEADERS = ['Guest name', 'Attendance', 'Haldi', 'Sangeet', 'Wedding & lunch',
  'Party contact', 'Contact email', 'Song request', 'Confirmation email',
  'RSVP submitted (ET)', 'Email sent (ET)', 'RSVP ID', 'Guest ID', 'Guest order'];

function installWeddingSheetSync() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Another wedding worker is running. Please try again.');
  try {
    var snapshot = weddingRpc_('export_nisha_sajal_rsvps', {});
    var rows = weddingSheetRows_(snapshot); // Validate before creating or changing a file.
    var properties = PropertiesService.getScriptProperties();
    var id = properties.getProperty(WEDDING_SHEET_ID_PROPERTY);
    var book;
    if (id) {
      book = SpreadsheetApp.openById(id);
    } else {
      book = SpreadsheetApp.create('Nisha & Sajal — RSVP confirmations');
      properties.setProperty(WEDDING_SHEET_ID_PROPERTY, book.getId());
      book.getSheets()[0].setName('Summary');
    }
    weddingSheetLayout_(book);
    weddingWriteSnapshot_(book, snapshot, rows);
    var installed = ScriptApp.getProjectTriggers().some(function(trigger) {
      return trigger.getHandlerFunction() === 'syncWeddingRsvpsToSheet';
    });
    if (!installed) ScriptApp.newTrigger('syncWeddingRsvpsToSheet').timeBased().everyMinutes(5).create();
    console.log('Private RSVP Sheet: ' + book.getUrl());
    console.log('Synced ' + snapshot.submissions_count + ' RSVPs and ' + rows.length + ' guests. Refresh: every five minutes.');
  } finally { lock.releaseLock(); }
}

function syncWeddingRsvpsToSheet() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // Email worker shares this lock; retry next cycle.
  var book;
  try {
    var id = PropertiesService.getScriptProperties().getProperty(WEDDING_SHEET_ID_PROPERTY);
    if (!id) throw new Error('Run installWeddingSheetSync first.');
    book = SpreadsheetApp.openById(id);
    var snapshot = weddingRpc_('export_nisha_sajal_rsvps', {});
    var rows = weddingSheetRows_(snapshot);
    weddingWriteSnapshot_(book, snapshot, rows);
    console.log('RSVP Sheet refreshed: ' + snapshot.submissions_count + ' RSVPs, ' + rows.length + ' guests.');
  } catch (error) {
    if (book && book.getSheetByName('Summary')) {
      book.getSheetByName('Summary').getRange('B5').setValue('Refresh failed — check Apps Script Executions');
    }
    throw new Error('RSVP Sheet refresh failed. Last successful refresh time is shown in Summary.');
  } finally { lock.releaseLock(); }
}

// Treat all guest-supplied strings as literal text, never spreadsheet formulas.
function weddingSheetText_(value) {
  var text = value == null ? '' : String(value);
  return /^[\s\u0000-\u001f]*[=+\-@']/.test(text) ? "'" + text : text;
}

function weddingSheetDate_(value, optional) {
  if (optional && value == null) return '';
  if (typeof value !== 'string') throw new Error('Invalid RSVP timestamp.');
  var date = new Date(value);
  if (!isFinite(date.getTime())) throw new Error('Invalid RSVP timestamp.');
  return date;
}

function weddingSheetRows_(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.guests) ||
      !Number.isInteger(snapshot.submissions_count) || snapshot.submissions_count < 0 ||
      snapshot.guests_count !== snapshot.guests.length) throw new Error('Invalid RSVP snapshot.');
  weddingSheetDate_(snapshot.generated_at, false);
  var ids = Object.create(null), parties = Object.create(null);
  var rows = snapshot.guests.map(function(guest) {
    if (!guest || typeof guest.guest_id !== 'string' || !guest.guest_id || ids[guest.guest_id] ||
        typeof guest.submission_id !== 'string' || !guest.submission_id ||
        !Number.isInteger(guest.guest_order) || guest.guest_order < 1 ||
        typeof guest.full_name !== 'string' || !guest.full_name.trim() ||
        typeof guest.attending !== 'boolean' || !Array.isArray(guest.events) ||
        guest.events.some(function(event) { return ['haldi', 'sangeet', 'wedding'].indexOf(event) < 0; }) ||
        new Set(guest.events).size !== guest.events.length ||
        (guest.attending ? guest.events.length === 0 : guest.events.length !== 0) ||
        ['pending', 'sending', 'sent', 'failed'].indexOf(guest.email_status) < 0) {
      throw new Error('Invalid or duplicate guest in RSVP snapshot.');
    }
    ids[guest.guest_id] = true;
    if (!parties[guest.submission_id]) parties[guest.submission_id] = Object.create(null);
    if (parties[guest.submission_id][guest.guest_order]) throw new Error('Duplicate guest order.');
    parties[guest.submission_id][guest.guest_order] = true;
    return [weddingSheetText_(guest.full_name), guest.attending ? 'Attending' : 'Unable to attend',
      guest.events.indexOf('haldi') >= 0 ? 'Yes' : '',
      guest.events.indexOf('sangeet') >= 0 ? 'Yes' : '',
      guest.events.indexOf('wedding') >= 0 ? 'Yes' : '',
      weddingSheetText_(guest.primary_name), weddingSheetText_(guest.contact_email),
      weddingSheetText_(guest.song_request), guest.email_status,
      weddingSheetDate_(guest.created_at, false), weddingSheetDate_(guest.email_sent_at, true),
      weddingSheetText_(guest.submission_id), weddingSheetText_(guest.guest_id), guest.guest_order];
  });
  if (Object.keys(parties).length !== snapshot.submissions_count || Object.keys(parties).some(function(id) {
    return !parties[id][1];
  })) throw new Error('RSVP totals do not reconcile.');
  return rows;
}

function weddingSheetLayout_(book) {
  book.setSpreadsheetTimeZone('America/New_York');
  book.setSpreadsheetLocale('en_US');
  var summary = book.getSheetByName('Summary') || book.insertSheet('Summary');
  var guests = book.getSheetByName('Guests') || book.insertSheet('Guests');
  [summary, guests].forEach(function(sheet) {
    sheet.setHiddenGridlines(true);
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet === summary ? 2 : 14)
      .setFontFamily('Arial').setFontSize(11).setFontColor('#25304d').setVerticalAlignment('middle');
  });
  summary.getRange('A1:B1').merge().setValue('Nisha & Sajal · RSVP confirmations').setFontSize(16).setFontWeight('bold');
  summary.getRange('A2:B2').merge().setValue('January 30–31, 2027 · Lansdowne Resort').setFontColor('#746775');
  summary.getRange('A4:A5').setValues([['Last successful refresh (ET)'], ['Sync status']]);
  summary.getRange('B4').setNumberFormat('mmm d, yyyy h:mm AM/PM');
  summary.getRange('A7:B7').setValues([['RSVP overview', 'Count']]);
  summary.getRange('A8:A11').setValues([['RSVP parties'], ['Named guests'], ['Attending at least one event'], ['Unable to attend']]);
  summary.getRange('B8:B11').setFormulas([
    ['=COUNTIF(Guests!N5:N,1)'], ['=COUNTA(Guests!A5:A)'],
    ['=COUNTIF(Guests!B5:B,"Attending")'], ['=COUNTIF(Guests!B5:B,"Unable to attend")']]);
  summary.getRange('A13:B13').setValues([['Event attendance', 'Guests']]);
  summary.getRange('A14:A16').setValues([['Haldi · Jan 30, 11am'], ['Sangeet · Jan 30, 6pm'], ['Wedding & lunch · Jan 31, 10am']]);
  summary.getRange('B14:B16').setFormulas([
    ['=COUNTIF(Guests!C5:C,"Yes")'], ['=COUNTIF(Guests!D5:D,"Yes")'], ['=COUNTIF(Guests!E5:E,"Yes")']]);
  summary.getRange('A18:B18').setValues([['Confirmation emails', 'Parties']]);
  summary.getRange('A19:A20').setValues([['Sent'], ['Not yet marked sent']]);
  summary.getRange('B19:B20').setFormulas([
    ['=COUNTIFS(Guests!N5:N,1,Guests!I5:I,"sent")'], ['=B8-B19']]);
  summary.getRange('A22:B22').merge().setValue('Use the Guests tab to filter names, events, song requests and email status.');
  summary.getRange('A23:B23').merge().setValue('Updates every five minutes. Edits here do not change RSVPs and are replaced on refresh.');
  summary.getRange('A24:B24').merge().setValue('Sent means Gmail accepted the message; it does not confirm inbox delivery.');
  summary.getRange('A22:B24').setWrap(true).setFontSize(10).setFontColor('#746775');
  [7, 13, 18].forEach(function(row) {
    summary.getRange(row, 1, 1, 2).setBackground('#25304d').setFontColor('#ffffff').setFontWeight('bold');
  });
  summary.setColumnWidth(1, 300); summary.setColumnWidth(2, 330);
  summary.setRowHeights(1, 24, 28); summary.setRowHeight(1, 36);
  summary.setRowHeights(22, 3, 38);
  summary.getRange('B8:B20').setNumberFormat('0').setHorizontalAlignment('right');
  summary.setFrozenRows(2);
  guests.getRange('A1:K1').merge().setValue('Guest responses').setFontSize(16).setFontWeight('bold');
  guests.getRange('A2:K2').merge().setValue('One row per named guest · Contact, song and email status repeat for members of the same party.').setFontColor('#746775');
  guests.getRange('A3:K3').merge().setFormula('=HYPERLINK("' + WEDDING_SUPABASE_URL.replace('.supabase.co', '')
    .replace('https://', 'https://supabase.com/dashboard/project/') + '/editor","Source: Supabase RSVP tables · private")').setFontSize(10);
  guests.getRange(4, 1, 1, 14).setValues([WEDDING_SHEET_HEADERS]).setBackground('#25304d').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
  guests.setRowHeights(1, 3, 28); guests.setRowHeight(4, 42);
  [220, 155, 80, 90, 130, 220, 260, 320, 155, 180, 180].forEach(function(width, index) {
    guests.setColumnWidth(index + 1, width);
  });
  guests.hideColumns(12, 3);
  guests.setFrozenRows(4);
}

function weddingWriteSnapshot_(book, snapshot, rows) {
  var guests = book.getSheetByName('Guests'), summary = book.getSheetByName('Summary');
  if (!guests || !summary) throw new Error('Sheet tabs missing. Run installWeddingSheetSync.');
  var previousLastRow = guests.getLastRow();
  var requiredRows = Math.max(rows.length + 4, 5);
  if (guests.getMaxRows() < requiredRows) guests.insertRowsAfter(guests.getMaxRows(), requiredRows - guests.getMaxRows());
  summary.getRange('B5').setValue('Refreshing…');
  if (rows.length) {
    guests.getRange(5, 1, rows.length, 14).setValues(rows).setWrap(true).setVerticalAlignment('top');
    guests.getRange(5, 10, rows.length, 2).setNumberFormat('mmm d, yyyy h:mm AM/PM');
  }
  if (previousLastRow > rows.length + 4) guests.getRange(rows.length + 5, 1, previousLastRow - rows.length - 4, 14).clearContent();
  var filter = guests.getFilter();
  if (!filter || filter.getRange().getNumRows() < requiredRows - 3) {
    if (filter) filter.remove();
    guests.getRange(4, 1, guests.getMaxRows() - 3, 14).createFilter();
  }
  SpreadsheetApp.flush();
  if (Number(summary.getRange('B8').getValue()) !== snapshot.submissions_count ||
      Number(summary.getRange('B9').getValue()) !== snapshot.guests_count) throw new Error('Sheet totals do not reconcile.');
  summary.getRange('B4').setValue(new Date(snapshot.generated_at));
  summary.getRange('B5').setValue('Up to date · refreshes every five minutes');
  SpreadsheetApp.flush();
}
