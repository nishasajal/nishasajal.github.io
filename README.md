# Nisha & Sajal wedding recreation

A local recreation of https://nisha-sajal-wedding.vercel.app, using its publicly served page structure, stylesheet, imagery, door video, music, and translations. The interactive JavaScript and local RSVP server have been rebuilt in readable source.

## Run

Requires Node.js 20 or newer. No dependencies or install step required.

```sh
node server.mjs
```

Open http://localhost:5173. Set `PORT` to use another port.

## Features

- Animated invitation doorway with the parents’ names beneath the couple and a background music toggle
- English/Hindi text switch
- A compact second slide with gold scratch circles and the countdown beneath, leading directly into Haldi; Enter/Space keyboard support for the scratch reveal
- Countdown to the celebrations on January 30, 2027 at 11am in Virginia
- Venue map link, event dress codes, RSVP and the wedding planner’s company and email contact
- Named party RSVPs, per-guest event choices, Supabase storage and Gmail confirmation emails
- A clearly labeled hotel room booking link appears above Confirm RSVP and remains available after success; hotel reservations are separate from the RSVP, and confirmation emails include the booking link
- Scroll reveals, confetti, responsive layout, and reduced-motion support

## Editing

- `index.html`: content and layout
- `app.js`: invitation behavior
- `rsvp.js` and `rsvp-model.mjs`: group RSVP form, validation and submission
- `styles.css`: reference site's compiled stylesheet
- `enhancements.css`: accessibility and small-screen adjustments
- `translations.json`: English/Hindi strings; update matching English HTML when editing a translation
- `assets/`: reference media
- `server.mjs`: static serving and local RSVP endpoint
- `rsvp-config.mjs`: public Supabase endpoint and publishable key used by the GitHub Pages build
- `supabase/`: database migrations and transactional access tests
- `email/`: private Gmail Apps Script worker and setup notes

Local development replies are saved in `data/rsvps.jsonl`. This directory is not publicly served. The development server binds to localhost. GitHub Pages sends replies to the validated Supabase function; visitors cannot read or directly edit guest records. Google Fonts requires internet access; other assets are local.

## Verification

Run `npm run check`, `npm test` and `npm run build`. Tests cover per-event counts, validation, normalized duplicate names, email recipient validation, stable request identities, escaped confirmation HTML, mail failures, delivery acknowledgement failures and exhausted quotas. Browser checks cover English/Hindi, mixed guest choices, party totals, mobile widths, sending feedback and retries with mocked requests. SQL tests in `supabase/tests/` check real writes and access rules inside rolled-back transactions; they leave no test guests or emails behind.

## GitHub Pages

The `main` branch deploys automatically through `.github/workflows/pages.yml`.
Run `npm run build` to generate `dist/`. Only public website files are included; database records, server, SQL and private worker code are excluded. Relative asset paths support the GitHub Pages project URL. The Supabase publishable key is a browser submission key, not an administrator secret. Never put a service-role key or Gmail worker secret in this site.

## Wedding submissions

One reply contains a contact email, one or more named guests, a Yes/No attendance answer and individual event choices for every guest, plus an optional song request. Additional attending guests and event totals are calculated automatically. Each attending guest must choose at least one event; declining guests have no selected events.

Supabase tables:

- `nisha_sajal_rsvps`: party totals, contact email, request identity and email delivery status.
- `nisha_sajal_rsvp_guests`: each named guest and their selected events.
- `nisha_sajal_event_counts`: organizer-only event totals.
- `nisha_sajal_email_worker`: private hashed credential for the Gmail worker.

All tables have Row Level Security and no anonymous or authenticated visitor access. The public RPC validates the entire reply and writes it atomically. Replaying the same submission UUID and contents is safe; changed contents cannot overwrite an existing reply. The internal guest writer is private. Guest names are not globally unique.

Organizers can review/export records through the project's Supabase dashboard. Confirmation emails use the private Google Apps Script in [email/README.md](email/README.md); no Gmail password is stored in this repository. The earlier Web3Forms integration is no longer used by this wedding site. The Prime Care repository and its form settings are unchanged.

## Event weekend

- January 30, 2027 at 11am: Haldi at Terrace Ballroom — Indian / Indo-Western.
- January 30, 2027: Sangeet at Clubhouse Ballroom — 6–7pm cocktail hour, dinner from 7pm onwards. Men: Formal; Women: Indo-Western / Traditional.
- January 31, 2027 at 10am: Wedding at Grand Ballroom — Royal Traditionals, followed by lunch.

The original doorway video is unchanged. Its background soundtrack is O Sajni Re. Event illustrations are
frames extracted at 23s, 31.5s and 42s from the user-supplied WhatsApp invitation
video. Only scene artwork and attire guidance were reused; its other couple's
names, dates, locations and contact details are not included. Event slides use full-width artwork, native scroll snapping and slide-in effects
with a reduced-motion fallback.

The additional guest count excludes the first named guest. A party with three attending people stores `attending_guests: 3` and `additional_guests: 2`. A declining primary guest can still submit other guests who attend. No dietary information is collected.

## Full-screen slides and soundtrack

Event scenes now fill the viewport. Native scroll snapping settles on one event
at a time; the rest of the page remains normally scrollable. Each slide also has
a Next link. Small landscape screens can scroll within an oversized slide to
keep all details accessible. Slide motion is disabled for reduced-motion users.

`assets/sajni-monogram.png` contains the N–heart–S monogram from the supplied
save-the-date invitation. It replaces the earlier vector monogram. `event-audio.js`
plays O Sajni Re continuously throughout the opening, scratch-date/confetti reveal, Haldi, Sangeet, wedding, venue, RSVP and footer. Music starts only after the invitation or music button is tapped. One looping audio element preserves its playback position across scrolling and pause/resume. Muting persists across scrolling.
Sources, licenses and modifications are documented in `ASSET-CREDITS.md`.

Browser verification covers full-width layouts at desktop and mobile sizes,
scroll snapping, actual audio decoding, crossfade cleanup, mute behavior, and
reduced-motion display.

## RSVP feedback and browser duplicate protection

The button has hover, focus, pressed, and busy styles, with an accessible live
status for sending, success, rejection, and uncertain delivery. A successful
response stores event-scoped SHA-256 name keys for every guest in localStorage. Names use Unicode NFKC normalization,
case folding via lowercase, trimmed edges and collapsed whitespace. Names and
form answers are not kept in browser storage. Confirmation markers are written
only after the provider acknowledges success; failed submissions remain retryable.
Web Locks serialize matching names across tabs where supported.

As requested, this is **same-browser protection**, not a server uniqueness
constraint. It covers confirmed replies submitted after this change. A different
browser, cleared/blocked storage or private browsing can bypass it. Without Web
Locks, simultaneous tabs are not serialized. A stable request UUID also protects database writes against retries after a lost network response; it does not impose a global unique-name constraint.

The venue now leads directly to the attendance form; the accommodation and
registry sections have been removed.

Lansdowne Resort names in the event slides and venue heading link to its official
website in a new tab. `music-samples.html` previews the selected 31-second O Sajni Re instrumental used throughout the invitation.

## #SajNi branding and continuous music

The supplied monogram appears on each event slide, the celebrations heading and
footer, with `#SajNi` in the invitation, celebrations heading, RSVP and footer.
The browser icon uses the supplied monogram too.

The player defaults to the user-supplied O Sajni Re instrumental. `WEDDING_CONFIG.backgroundMusic` can override its `{ src, title }`. One audio element retains its playback position as guests move between slides or pause/resume. Playback begins only after the guest opens the invitation or presses Play.

`assets/rsvp-sajni-re.mp3` preserves the full 31-second user-supplied clip with reduced volume and soft fades at the loop boundary. Ve Kamleya and the earlier two-song preview remain archived assets and are not used or requested by the invitation or soundtrack preview page.

The Haldi, Sangeet and wedding slides include the user-provided two-line English verses with Hindi translations through the language toggle. Each verse line wraps independently into balanced, centered lines. Countdown labels use compact tracking and aligned numbers; event headings scale for narrow phones. Slides can grow on short screens so venue details stay clear of the bottom controls. English and Hindi layouts are checked from 320px through desktop widths.
