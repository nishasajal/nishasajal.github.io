begin;

-- A full, read-only snapshot for the existing private Apps Script worker.
-- The website's publishable key alone cannot call this successfully.
create or replace function public.export_nisha_sajal_rsvps(p_worker_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare snapshot jsonb;
begin
  if p_worker_key is null or char_length(p_worker_key) < 40 or not exists (
    select 1 from public.nisha_sajal_email_worker
    where singleton and enabled
      and key_hash = encode(sha256(convert_to(p_worker_key, 'UTF8')), 'hex')
  ) then
    raise exception using errcode = '42501', message = 'RSVP export unauthorized';
  end if;

  -- One SQL statement keeps counts and rows in the same database snapshot.
  select jsonb_build_object(
    'generated_at', now(),
    'submissions_count', (select count(*) from public.nisha_sajal_rsvps),
    'guests_count', count(*),
    'guests', coalesce(jsonb_agg(jsonb_build_object(
      'guest_id', g.id, 'submission_id', r.id, 'guest_order', g.guest_order,
      'full_name', g.full_name, 'attending', g.attending, 'events', g.events,
      'primary_name', r.primary_name, 'contact_email', r.contact_email,
      'song_request', r.song_request, 'email_status', r.email_status,
      'created_at', r.created_at, 'email_sent_at', r.email_sent_at
    ) order by r.created_at, r.id, g.guest_order), '[]'::jsonb)
  ) into snapshot
  from public.nisha_sajal_rsvp_guests g
  join public.nisha_sajal_rsvps r on r.id = g.submission_id;
  return snapshot;
end $$;

revoke all on function public.export_nisha_sajal_rsvps(text) from public, anon, authenticated;
grant execute on function public.export_nisha_sajal_rsvps(text) to anon, service_role;
notify pgrst, 'reload schema';
commit;
