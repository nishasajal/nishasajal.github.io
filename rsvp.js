// One party submission, with a separate attendance choice for every guest.
const form = $("#rsvp-form");
const guestList = $("#rsvp-guests");
const addGuestButton = $("#add-guest");
const submitButton = $("#rsvp-submit-btn");
const status = $("#rsvp-status");
const note = $("#rsvp-note");
const partySummary = $("#rsvp-party-summary");
const rsvpConfig = window.WEDDING_CONFIG || {};
const rsvpEndpoint = rsvpConfig.rsvpEndpoint;
const isSupabase = rsvpConfig.rsvpProvider === "supabase";
const roomBlockUrl = "https://book.passkey.com/e/51354114";
const receiptPrefix = "nisha-sajal:rsvp:confirmed:v1:";
const requestPrefix = "nisha-sajal:rsvp:request:v2:";
const confirmedNames = new Set();
const requestIds = new Map();
const guestCards = [];
let nextGuestId = 0;
let submitting = false;
let rsvpState = "idle";
let submittedData;
let confirmationCard;
const botcheck = document.createElement("input");
Object.assign(botcheck, { type: "checkbox", name: "botcheck", tabIndex: -1, hidden: true, autocomplete: "off" });
botcheck.setAttribute("aria-hidden", "true");
form.append(botcheck);
const rsvpLabels = {
  en: {
    intro: "Reply for yourself and your guests. Choose the events each person will attend.",
    email: "Email address", emailHelp: isSupabase ? "We’ll send your party’s confirmation to this email." : "One email address for this RSVP.",
    addGuest: "+ Add guest", guest: "Guest", you: "You", remove: "Remove", fullName: "Full name",
    attending: "Will this guest attend?", select: "Select", yes: "Yes", no: "Unable to attend",
    events: "Which events will this guest attend?", eventHelp: "Select at least one event.",
    song: "What song will get you on the dance floor?", names: "Names listed", attendingCount: "Attending", plusOnes: "Additional guests attending",
    privateNote: "Your reply will be saved privately for the wedding organizers.", localNote: "Development preview: replies are saved locally.",
    thankYou: "Thank You", confirmation: "Your RSVP is confirmed", declined: "Unable to attend", summary: "Your party’s attendance",
    nextStep: "Next step", bookStay: "Hotel room booking", bookRoom: "Book a hotel room",
    haldi: "Haldi", sangeet: "Sangeet", wedding: "Wedding & lunch",
    haldiDetails: "Jan 30 · 11am · Terrace Ballroom", sangeetDetails: "Jan 30 · 6–7pm: Cocktail hour; 7pm onwards: Dinner · Clubhouse Ballroom", weddingDetails: "Jan 31 · 10am, followed by lunch · Grand Ballroom",
  },
  hi: {
    intro: "अपने और अपने मेहमानों के लिए उत्तर दें। हर व्यक्ति जिन कार्यक्रमों में आएगा, उन्हें चुनें।",
    email: "ईमेल पता", emailHelp: isSupabase ? "आपके समूह की पुष्टि इस ईमेल पर भेजी जाएगी।" : "इस RSVP के लिए एक ईमेल पता।",
    addGuest: "+ मेहमान जोड़ें", guest: "मेहमान", you: "आप", remove: "हटाएँ", fullName: "पूरा नाम",
    attending: "क्या यह मेहमान आएगा?", select: "चुनें", yes: "हाँ", no: "नहीं आ सकेंगे",
    events: "यह मेहमान किन कार्यक्रमों में आएगा?", eventHelp: "कम से कम एक कार्यक्रम चुनें।",
    song: "कौन सा गाना आपको डांस फ्लोर पर लाएगा?", names: "कुल नाम", attendingCount: "आने वाले", plusOnes: "आने वाले अतिरिक्त मेहमान",
    privateNote: "आपका उत्तर शादी के आयोजकों के लिए निजी रूप से सहेजा जाएगा।", localNote: "डेवलपमेंट प्रीव्यू: उत्तर स्थानीय रूप से सहेजे जाते हैं।",
    thankYou: "धन्यवाद", confirmation: "आपके RSVP की पुष्टि हो गई है", declined: "नहीं आ सकेंगे", summary: "आपके समूह की उपस्थिति",
    nextStep: "अगला कदम", bookStay: "होटल के कमरे की बुकिंग", bookRoom: "होटल का कमरा बुक करें",
    haldi: "हल्दी", sangeet: "संगीत", wedding: "विवाह और दोपहर का भोजन",
    haldiDetails: "३० जनवरी · सुबह ११ बजे · टेरेस बॉलरूम", sangeetDetails: "३० जनवरी · शाम ६–७ बजे: कॉकटेल आवर; शाम ७ बजे से: रात्रि भोज · क्लबहाउस बॉलरूम", weddingDetails: "३१ जनवरी · सुबह १० बजे, फिर दोपहर का भोजन · ग्रैंड बॉलरूम",
  },
};
const rsvpCopy = {
  en: {
    idle: ["Confirm RSVP", ""], checking: ["Checking…", "Checking your RSVP…"],
    sending: ["Sending…", "Saving your RSVP. Please keep this page open."],
    slow: ["Sending…", "Still saving your RSVP. Please keep this page open."],
    error: ["Try again", "Unable to save your reply. Please check your connection and try again."],
    uncertain: ["Try again", "We couldn’t confirm the save. Please try again; the same reply won’t be stored twice."],
    duplicate: ["Already received", "An RSVP for a guest in this party has already been received in this browser. Please contact the wedding organizers to make a change."],
    invalid: ["Confirm RSVP", "Please complete the required fields for each guest."],
    invalidName: ["Confirm RSVP", "Please enter a full name for every guest."],
    repeatedName: ["Confirm RSVP", "Please list each guest only once."],
    invalidGuests: ["Confirm RSVP", "Please include between 1 and 100 named guests."],
    invalidAttendance: ["Confirm RSVP", "Please choose whether each guest will attend."],
    invalidEvents: ["Confirm RSVP", "Please choose at least one event for each guest who is attending."],
    invalidSong: ["Confirm RSVP", "Please keep the song request under 2,000 characters."],
    invalidEmail: ["Confirm RSVP", "Please enter a valid email address."],
    success: ["RSVP received", isSupabase ? "Your reply has been saved. A confirmation email is queued for the address you provided." : "Your reply has been received. Thank you for letting us know."],
  },
  hi: {
    idle: ["RSVP की पुष्टि करें", ""], checking: ["जाँच हो रही है…", "आपके RSVP की जाँच हो रही है…"],
    sending: ["भेजा जा रहा है…", "आपका RSVP सहेजा जा रहा है। कृपया यह पेज खुला रखें।"],
    slow: ["भेजा जा रहा है…", "आपका RSVP अभी सहेजा जा रहा है। कृपया यह पेज खुला रखें।"],
    error: ["फिर कोशिश करें", "आपका उत्तर सहेजा नहीं जा सका। कृपया अपना कनेक्शन जाँचें और फिर प्रयास करें।"],
    uncertain: ["फिर कोशिश करें", "उत्तर सहेजे जाने की पुष्टि नहीं हो सकी। दोबारा प्रयास करें; वही उत्तर दो बार नहीं सहेजा जाएगा।"],
    duplicate: ["उत्तर प्राप्त हो चुका है", "इस समूह के किसी मेहमान का RSVP इस ब्राउज़र से पहले ही प्राप्त हो चुका है। बदलाव के लिए आयोजकों से संपर्क करें।"],
    invalid: ["RSVP की पुष्टि करें", "कृपया हर मेहमान की आवश्यक जानकारी भरें।"],
    invalidName: ["RSVP की पुष्टि करें", "कृपया हर मेहमान का पूरा नाम दर्ज करें।"],
    repeatedName: ["RSVP की पुष्टि करें", "कृपया हर मेहमान का नाम केवल एक बार लिखें।"],
    invalidGuests: ["RSVP की पुष्टि करें", "कृपया १ से १०० मेहमानों के नाम दर्ज करें।"],
    invalidAttendance: ["RSVP की पुष्टि करें", "कृपया बताएँ कि हर मेहमान आएगा या नहीं।"],
    invalidEvents: ["RSVP की पुष्टि करें", "आने वाले हर मेहमान के लिए कम से कम एक कार्यक्रम चुनें।"],
    invalidSong: ["RSVP की पुष्टि करें", "कृपया गाने का अनुरोध २,००० अक्षरों से कम रखें।"],
    invalidEmail: ["RSVP की पुष्टि करें", "कृपया सही ईमेल पता दर्ज करें।"],
    success: ["RSVP प्राप्त हुआ", isSupabase ? "आपका उत्तर सहेज लिया गया है। दिए गए पते पर पुष्टि ईमेल भेजने के लिए तैयार है।" : "आपका उत्तर प्राप्त हो गया है। हमें बताने के लिए धन्यवाद।"],
  },
};
function labelElement(tag, key, className = "") {
  const element = document.createElement(tag);
  element.dataset.rsvpLabel = key;
  element.className = className;
  element.textContent = rsvpLabels[language][key];
  return element;
}
function addGuest() {
  if (submitting || guestCards.length >= 100) return;
  const id = ++nextGuestId;
  const card = document.createElement("fieldset");
  card.className = "rsvp-guest-card";
  const legend = document.createElement("legend");
  card.append(legend);
  const remove = labelElement("button", "remove", "rsvp-remove-guest");
  remove.type = "button";
  card.append(remove);
  const nameLabel = document.createElement("label");
  nameLabel.className = "grid gap-2";
  const name = document.createElement("input");
  Object.assign(name, { id: `guest-${id}-name`, name: `guest-${id}-name`, required: true, maxLength: 200, autocomplete: guestCards.length ? "off" : "name", className: "rsvp-text-input" });
  nameLabel.append(labelElement("span", "fullName", "eyebrow"), name);
  const attendanceLabel = document.createElement("label");
  attendanceLabel.className = "grid gap-2";
  const attendance = document.createElement("select");
  Object.assign(attendance, { id: `guest-${id}-attending`, name: `guest-${id}-attending`, required: true, className: "rsvp-text-input" });
  for (const [value, key] of [["", "select"], ["Yes", "yes"], ["No", "no"]]) {
    const option = labelElement("option", key); option.value = value; option.disabled = !value; attendance.append(option);
  }
  attendance.value = "";
  attendanceLabel.append(labelElement("span", "attending", "eyebrow"), attendance);
  const events = document.createElement("fieldset");
  events.className = "rsvp-event-options";
  events.hidden = true;
  const eventLegend = labelElement("legend", "events", "eyebrow");
  const help = labelElement("p", "eventHelp", "rsvp-event-help"); help.id = `guest-${id}-events-help`;
  events.append(eventLegend, help);
  const checkboxes = ["haldi", "sangeet", "wedding"].map((event) => {
    const label = document.createElement("label"); label.className = "rsvp-event-choice";
    const checkbox = document.createElement("input");
    Object.assign(checkbox, { type: "checkbox", name: `guest-${id}-events`, value: event, disabled: true });
    checkbox.setAttribute("aria-describedby", help.id);
    const copy = document.createElement("span");
    copy.append(labelElement("strong", event), labelElement("small", event + "Details"));
    label.append(checkbox, copy); events.append(label);
    return checkbox;
  });
  card.append(nameLabel, attendanceLabel, events);
  const guest = { card, legend, name, attendance, events, checkboxes, remove };
  guestCards.push(guest); guestList.append(card);
  attendance.addEventListener("change", () => {
    events.hidden = attendance.value !== "Yes";
    checkboxes.forEach((checkbox) => {
      checkbox.disabled = attendance.value !== "Yes";
      if (checkbox.disabled) checkbox.checked = false;
    });
    clearGuestValidity(guest); updatePartySummary();
  });
  checkboxes.forEach((checkbox) => checkbox.addEventListener("change", () => { clearGuestValidity(guest); updatePartySummary(); }));
  remove.addEventListener("click", () => {
    if (submitting) return;
    const index = guestCards.indexOf(guest);
    guestCards.splice(index, 1); card.remove();
    updateRsvpAvailability(); updatePartySummary(); setRsvpState("idle");
    guestCards[Math.max(0, index - 1)].name.focus();
  });
  updateRsvpAvailability(); updatePartySummary();
  if (guestCards.length > 1) name.focus();
}
function clearGuestValidity(guest) {
  guest.checkboxes[0].setCustomValidity("");
  if (!submitting) setRsvpState("idle");
}
function guestValues() {
  return guestCards.map(({ name, attendance, checkboxes }) => ({
    name: name.value,
    attending: attendance.value === "Yes" ? true : attendance.value === "No" ? false : null,
    events: attendance.value === "Yes" ? checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value) : [],
  }));
}
function updatePartySummary() {
  const guests = guestValues(), copy = rsvpLabels[language];
  const counts = [
    [copy.names, guests.length], [copy.attendingCount, guests.filter((g) => g.attending).length],
    [copy.plusOnes, guests.slice(1).filter((g) => g.attending).length],
    ...["haldi", "sangeet", "wedding"].map((id) => [copy[id], guests.filter((g) => g.events.includes(id)).length]),
  ];
  partySummary.replaceChildren();
  counts.forEach(([label, count]) => {
    const row = document.createElement("p"), value = document.createElement("strong");
    value.textContent = String(count); row.append(document.createTextNode(label), value); partySummary.append(row);
  });
}
function updateRsvpAvailability() {
  const copy = rsvpLabels[language];
  $$('[data-rsvp-label]').forEach((el) => { el.textContent = copy[el.dataset.rsvpLabel]; });
  guestCards.forEach((guest, index) => {
    guest.legend.textContent = index ? `${copy.guest} ${index + 1}` : `${copy.guest} 1 · ${copy.you}`;
    guest.remove.hidden = !index;
    guest.remove.setAttribute("aria-label", `${copy.remove} ${copy.guest.toLowerCase()} ${index + 1}`);
  });
  addGuestButton.disabled = submitting || guestCards.length >= 100;
  note.textContent = isSupabase ? copy.privateNote : copy.localNote;
  updatePartySummary();
  if (confirmationCard) renderConfirmation();
}
function renderRsvpState() {
  const [label, message] = rsvpCopy[language][rsvpState];
  submitButton.textContent = label; status.textContent = message;
  status.dataset.state = rsvpState; submitButton.dataset.state = rsvpState;
  submitButton.disabled = !rsvpEndpoint || submitting || rsvpState === "duplicate";
  submitButton.setAttribute("aria-busy", String(submitting)); form.setAttribute("aria-busy", String(submitting));
}
function setRsvpState(state) { rsvpState = state; renderRsvpState(); }
function wasConfirmed(key) {
  try { return confirmedNames.has(key) || localStorage.getItem(receiptPrefix + key) === "1"; }
  catch { return confirmedNames.has(key); }
}
function rememberConfirmation(key) {
  confirmedNames.add(key);
  try { localStorage.setItem(receiptPrefix + key, "1"); } catch {}
}
function submissionId(key) {
  let id = requestIds.get(key);
  try { id ||= localStorage.getItem(requestPrefix + key); } catch {}
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || "")) id = crypto.randomUUID();
  requestIds.set(key, id);
  try { localStorage.setItem(requestPrefix + key, id); } catch {}
  return id;
}
function renderConfirmation() {
  const copy = rsvpLabels[language];
  confirmationCard.replaceChildren();
  const check = document.createElement("span"); check.className = "rsvp-success-check"; check.textContent = "✓"; check.setAttribute("aria-hidden", "true");
  const heading = document.createElement("h3"); heading.id = "rsvp-success-title"; heading.className = "script text-5xl text-gold"; heading.textContent = copy.thankYou;
  const message = document.createElement("p"); message.className = "rsvp-confirmation-intro"; message.textContent = copy.confirmation;
  confirmationCard.append(check, heading, message);
  submittedData.guests.forEach((guest) => {
    const row = document.createElement("div"); row.className = "rsvp-confirmed-guest";
    const name = document.createElement("strong"); name.textContent = guest.name;
    const events = document.createElement("p"); events.textContent = guest.attending ? guest.events.map((id) => copy[id]).join(" · ") : copy.declined;
    row.append(name, events); confirmationCard.append(row);
  });
  const counts = document.createElement("p"); counts.className = "rsvp-confirmed-counts";
  counts.textContent = ["haldi", "sangeet", "wedding"].map((id) => `${copy[id]}: ${submittedData.guests.filter((g) => g.events.includes(id)).length}`).join(" · ");
  confirmationCard.append(counts, status);
  const nextStep = document.createElement("section"); nextStep.className = "rsvp-next-step";
  nextStep.setAttribute("aria-labelledby", "rsvp-room-heading");
  const stepLabel = document.createElement("p"); stepLabel.className = "eyebrow"; stepLabel.textContent = copy.nextStep;
  const roomHeading = document.createElement("h4"); roomHeading.id = "rsvp-room-heading"; roomHeading.textContent = copy.bookStay;
  const roomLink = document.createElement("a"); roomLink.id = "rsvp-room-block"; roomLink.className = "rsvp-room-button";
  roomLink.href = roomBlockUrl; roomLink.target = "_blank"; roomLink.rel = "noopener noreferrer";
  roomLink.textContent = copy.bookRoom;
  nextStep.append(stepLabel, roomHeading, roomLink); confirmationCard.append(nextStep);
}
addGuestButton.addEventListener("click", addGuest);
form.addEventListener("input", () => { if (!submitting && rsvpState !== "idle") setRsvpState("idle"); });
form.addEventListener("invalid", () => { if (!submitting) setRsvpState("invalid"); }, true);
addGuest(); renderRsvpState();
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!rsvpEndpoint || submitting || botcheck.checked || !form.reportValidity()) return;
  for (const guest of guestCards) {
    if (guest.attendance.value === "Yes" && !guest.checkboxes.some((checkbox) => checkbox.checked)) {
      setRsvpState("invalidEvents");
      guest.checkboxes[0].setCustomValidity(rsvpLabels[language].eventHelp);
      guest.checkboxes[0].reportValidity(); return;
    }
  }
  submitting = true; setRsvpState("checking");
  const controls = $$("input, select, button", form).map((control) => [control, control.disabled]);
  controls.forEach(([control]) => { control.disabled = true; });
  let slowTimer, timeoutTimer, requestStarted = false, responseReceived = false;
  try {
    const { validateRsvp, createRequestKey } = await import("./rsvp-model.mjs");
    // Read selected values before disabled form controls can affect serialization.
    const data = validateRsvp({ guests: guestCards.map((g) => ({ name: g.name.value, attending: g.attendance.value === "Yes" ? true : g.attendance.value === "No" ? false : null, events: g.attendance.value === "Yes" ? g.checkboxes.filter((c) => c.checked).map((c) => c.value) : [] })), song: $('[name=song]', form).value, email: $('[name=email]', form).value });
    const { createNameKey } = await import("./rsvp-identity.mjs");
    const keys = await Promise.all(data.guests.map((guest) => createNameKey(guest.name)));
    const id = submissionId(await createRequestKey(data));
    async function sendReply() {
      if (keys.some(wasConfirmed)) { setRsvpState("duplicate"); return; }
      setRsvpState("sending");
      const payload = isSupabase ? { p_submission_id: id, p_guests: data.guests, p_song_request: data.song, p_email: data.email } : { submissionId: id, ...data };
      const controller = new AbortController();
      slowTimer = setTimeout(() => setRsvpState("slow"), 10000);
      timeoutTimer = setTimeout(() => controller.abort(), 30000);
      requestStarted = true;
      const response = await fetch(rsvpEndpoint, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ...(isSupabase ? { apikey: rsvpConfig.supabasePublishableKey } : {}) },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      responseReceived = true;
      const result = await response.json();
      if (!response.ok || result?.ok !== true || result.submission_id !== id) throw new Error("RSVP rejected");
      keys.forEach(rememberConfirmation);
      clearTimeout(slowTimer); clearTimeout(timeoutTimer);
      submitting = false; setRsvpState("success"); submittedData = data;
      confirmationCard = document.createElement("div");
      confirmationCard.id = "rsvp-confirmation"; confirmationCard.className = "surface-card mt-9 rounded-sm px-7 py-12 text-center"; confirmationCard.tabIndex = -1;
      confirmationCard.setAttribute("aria-labelledby", "rsvp-success-title");
      renderConfirmation(); form.replaceWith(confirmationCard); confirmationCard.focus({ preventScroll: true }); confetti();
    }
    // One party lock also covers overlapping guests submitted from different tabs.
    if (navigator.locks?.request) await navigator.locks.request("nisha-sajal:rsvp:party-submit", sendReply);
    else await sendReply();
  } catch (error) {
    setRsvpState(rsvpCopy.en[error.message] ? error.message : requestStarted && !responseReceived ? "uncertain" : "error");
  } finally {
    clearTimeout(slowTimer); clearTimeout(timeoutTimer);
    controls.forEach(([control, disabled]) => { control.disabled = disabled; });
    submitting = false; renderRsvpState();
  }
});
