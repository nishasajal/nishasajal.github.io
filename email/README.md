# Gmail RSVP confirmations

The private [Google Apps Script project](https://script.google.com/home/projects/1LKVS-sQVOeKIDWR9N9SotnmjHLcU6acMLUZvh-0rwqrvWZAO5XsnpBig/edit) sends from the owner's Gmail account, `rishimash007@gmail.com`, with display name **Nisha & Sajal**. Guests can reply to that address for corrections. There is no public Apps Script web app and no Gmail password or administrative Supabase key in the website.

The one-minute time trigger reads pending submissions from Supabase using a private worker key stored only in Script Properties. Supabase stores its SHA-256 hash. The site only has the publishable key and cannot read queued replies, stored guests or the worker setting. The script uses MailApp to send email; it does not read the inbox.

Each receipt includes every named guest's response, a next-step booking button for the [wedding room block](https://book.passkey.com/e/51354114), event totals, the event dates, rooms, attire, resort address and invitation link. The room-block URL is included in both HTML and plain-text email. Names are HTML-escaped. One receipt goes to the party's contact email.

## Setup or recovery

1. Apply the SQL migrations in filename order in the project's SQL editor. For an existing installation, apply only unapplied migrations; do not rerun table creation migrations.
2. Copy `Code.gs` into a private Apps Script project owned by the desired sender. `appsscript.json` documents the three required scopes: sending mail, external requests and installing a trigger. Authorize them with that Google account.
3. Run `prepareWeddingEmailWorker`. It generates a private key in Script Properties and logs only the hash. Do not copy or publish the actual key.
4. Register the printed hash in the private database table:

```sql
insert into public.nisha_sajal_email_worker(singleton,key_hash,enabled)
values(true,'PRINTED_SHA256_HASH',true)
on conflict(singleton) do update set key_hash=excluded.key_hash,enabled=true;
```

5. Run `installWeddingEmailTrigger`. It verifies the connection without claiming replies, checks Gmail quota and installs a single one-minute trigger. Run `sendWeddingConfirmations` to process any existing queue, or let the trigger do it.

## Delivery behavior

Gmail's daily recipient quota applies. The worker uses Google's actual remaining quota and leaves pending replies queued when exhausted. Transient failures retry after 15 minutes, for up to five attempts. There is a maximum of three confirmations to one email address per 24 hours. Lease tokens prevent overlapping workers from completing another worker's job. Private sent markers prevent a routine database acknowledgement failure from sending the same message again; email delivery is not a transactional exactly-once guarantee.

Check the Apps Script **Executions** and **Triggers** screens for errors. In Supabase, inspect `email_status`, `email_attempts`, `email_sent_at` and `email_last_error` in `nisha_sajal_rsvps`. `sent` means Gmail accepted the message for sending, not proof of inbox placement. Check spam when troubleshooting.

To pause new sends, set `enabled=false` on `nisha_sajal_email_worker`. To retry a failed reply after fixing the cause, reset `email_attempts=0` and `email_attempted_at=null` for that specific failed submission in the dashboard. Do not reset a sent row or erase its sent marker to retry a status update.

Unit tests use mocked mail delivery. SQL access tests roll back their fixtures and never send emails. No test messages are sent to real participants.
