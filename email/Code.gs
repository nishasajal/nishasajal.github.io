// Private Gmail confirmation worker. Never publish this as an anonymous web app.
// Run prepareWeddingEmailWorker, register its printed hash in Supabase, then installWeddingEmailTrigger.
var WEDDING_SUPABASE_URL = 'https://vtaojbbnrftqqhyqodum.supabase.co';
var WEDDING_PUBLISHABLE_KEY = 'sb_publishable_r99jzYUDLr0QeOS9rjQ3Dw_5Z9GwP2A';
var WEDDING_SITE = 'https://nishasajal.github.io/';
var WEDDING_ROOM_BLOCK = 'https://book.passkey.com/e/51354114';

function prepareWeddingEmailWorker() {
  var properties = PropertiesService.getScriptProperties();
  var key = properties.getProperty('WEDDING_WORKER_KEY');
  if (!key) {
    key = Utilities.getUuid() + Utilities.getUuid();
    properties.setProperty('WEDDING_WORKER_KEY', key);
  }
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key, Utilities.Charset.UTF_8)
    .map(function(byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
  console.log('Worker key hash (safe to register in Supabase): ' + hash);
}

function weddingRpc_(name, data) {
  var key = PropertiesService.getScriptProperties().getProperty('WEDDING_WORKER_KEY');
  if (!key) throw new Error('Run prepareWeddingEmailWorker first.');
  data.p_worker_key = key;
  var response = UrlFetchApp.fetch(WEDDING_SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'post', contentType: 'application/json', headers: { apikey: WEDDING_PUBLISHABLE_KEY },
    payload: JSON.stringify(data), muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300)
    throw new Error('Wedding database request failed (' + response.getResponseCode() + ').');
  return JSON.parse(response.getContentText());
}

function installWeddingEmailTrigger() {
  weddingRpc_('claim_nisha_sajal_emails', { p_limit: 0 });
  var quota = MailApp.getRemainingDailyQuota();
  var installed = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'sendWeddingConfirmations';
  });
  if (!installed) ScriptApp.newTrigger('sendWeddingConfirmations').timeBased().everyMinutes(1).create();
  console.log('Wedding confirmation worker is ready. Remaining daily recipients: ' + quota);
}

function sendWeddingConfirmations() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var quota = MailApp.getRemainingDailyQuota();
    if (quota < 1) return; // Pending replies remain queued until the quota resets.
    var jobs = weddingRpc_('claim_nisha_sajal_emails', { p_limit: Math.min(10, quota) });
    var properties = PropertiesService.getScriptProperties();
    jobs.forEach(function(job) {
      var receiptKey = 'sent:' + job.id;
      var sent = Boolean(properties.getProperty(receiptKey));
      try {
        if (!sent) {
          var message = weddingConfirmation_(job);
          MailApp.sendEmail({ to: job.email, subject: message.subject, body: message.text,
            htmlBody: message.html, name: 'Nisha & Sajal' });
          sent = true;
          properties.setProperty(receiptKey, new Date().toISOString());
        }
        weddingRpc_('complete_nisha_sajal_email', { p_submission_id: job.id, p_claim_token: job.claim_token, p_success: true });
      } catch (error) {
        if (!sent) {
          try { weddingRpc_('complete_nisha_sajal_email', { p_submission_id: job.id, p_claim_token: job.claim_token, p_success: false }); }
          catch (ignored) { /* The claim will expire and can be retried. */ }
        }
        console.error('Confirmation attempt needs retry for submission ' + job.id + '.');
      }
    });
    console.log('Processed ' + jobs.length + ' queued wedding confirmations.');
  } finally { lock.releaseLock(); }
}

function escapeWeddingHtml_(value) {
  return String(value).replace(/[&<>"']/g, function(character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}

function weddingConfirmation_(job) {
  var events = {
    haldi: { title: 'Haldi', date: 'Saturday, January 30, 2027 · 11am', location: 'Terrace Ballroom', attire: 'Indian / Indo-Western' },
    sangeet: { title: 'Sangeet', date: 'Saturday, January 30, 2027 · 6–7pm: Cocktail hour; 7pm onwards: Dinner', location: 'Clubhouse Ballroom', attire: 'Men: Formal; Women: Indo-Western / Traditional' },
    wedding: { title: 'Wedding & lunch', date: 'Sunday, January 31, 2027 · 10am, followed by lunch', location: 'Grand Ballroom', attire: 'Royal Traditionals' },
  };
  var rows = job.guests.map(function(guest) {
    var choices = guest.attending ? guest.events.map(function(id) { return events[id].title; }).join(' · ') : 'Unable to attend';
    return '<tr><td style="padding:16px 0;border-bottom:1px solid #e4d9cd"><strong style="color:#25304d">' + escapeWeddingHtml_(guest.name) + '</strong><br><span style="font-size:13px;color:#746775;line-height:1.8">' + escapeWeddingHtml_(choices) + '</span></td></tr>';
  }).join('');
  var details = Object.keys(events).map(function(id) {
    var event = events[id];
    var count = job.guests.filter(function(guest) { return guest.events.indexOf(id) >= 0; }).length;
    return '<div style="padding:20px 0;border-bottom:1px solid #e4d9cd"><h3 style="font-family:Georgia,serif;font-size:23px;font-weight:normal;color:#25304d;margin:0 0 8px">' + event.title + '</h3><p style="font-size:13px;color:#746775;line-height:1.9;margin:0">' + event.date + '<br>' + event.location + ' · Lansdowne Resort<br>Attire: ' + event.attire + '<br><strong>Guests attending: ' + count + '</strong></p></div>';
  }).join('');
  var roomBlockHtml = '<div style="margin:24px 0;padding:22px;border:1px solid #e4d9cd;background:#f7f1e7;text-align:center"><p style="font-size:11px;letter-spacing:2px;color:#746775;margin:0 0 8px;text-transform:uppercase">Next step</p><h2 style="font-family:Georgia,serif;font-weight:normal;color:#25304d;font-size:26px;margin:0 0 12px">Book your stay</h2><p style="font-size:13px;color:#746775;line-height:1.7;margin:0 0 18px">Staying at Lansdowne Resort? Reserve your room through our wedding room block.</p><a href="' + WEDDING_ROOM_BLOCK + '" style="background:#25304d;color:white;text-decoration:none;padding:14px 22px;border-radius:4px;display:inline-block">Book your room</a></div>';
  var html = '<!doctype html><html><body style="margin:0;background:#f8f5ee;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:30px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffcf7;border:1px solid #e4d9cd"><tr><td style="padding:36px 28px"><p style="text-align:center;color:#b78372;font-family:Georgia,serif;font-size:32px;margin:0">Nisha &amp; Sajal</p><p style="text-align:center;color:#b78372;font-family:Georgia,serif;font-style:italic;font-size:23px;margin:12px 0 30px">#SajNi</p><h1 style="font-family:Georgia,serif;font-weight:normal;color:#25304d;font-size:29px;text-align:center">Your RSVP is confirmed</h1><p style="color:#746775;font-size:14px;line-height:1.8;text-align:center">Thank you for letting us know. Here is a copy of your party’s response.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">' + rows + '</table>' + roomBlockHtml + details + '<p style="font-size:13px;color:#746775;line-height:1.9;margin-top:24px"><a style="color:#8e6b58" href="https://lansdowneresort.com/">Lansdowne Resort</a><br>44050 Woodridge Parkway, Leesburg, VA 20176</p><p style="text-align:center;margin:30px 0"><a href="' + WEDDING_SITE + '" style="background:#25304d;color:white;text-decoration:none;padding:13px 23px;display:inline-block">View the invitation</a></p><p style="font-size:12px;color:#746775;line-height:1.8;text-align:center">Need to change your response? Reply to this email and we’ll help.</p></td></tr></table></td></tr></table></body></html>';
  var text = 'Nisha & Sajal · #SajNi\nYour RSVP is confirmed\n\n' + job.guests.map(function(guest) {
    return guest.name + ': ' + (guest.attending ? guest.events.map(function(id) { return events[id].title; }).join(', ') : 'Unable to attend');
  }).join('\n') + '\n\nNext step: Book your stay\nStaying at Lansdowne Resort? Reserve your room through our wedding room block.\n' + WEDDING_ROOM_BLOCK + '\n\n' + Object.keys(events).map(function(id) {
    var event = events[id]; return event.title + '\n' + event.date + '\n' + event.location + ' · Lansdowne Resort\nAttire: ' + event.attire;
  }).join('\n\n') + '\n\n44050 Woodridge Parkway, Leesburg, VA 20176\n' + WEDDING_SITE + '\n\nNeed to change your response? Reply to this email.';
  return { subject: 'Nisha & Sajal — your RSVP is confirmed', html: html, text: text };
}
