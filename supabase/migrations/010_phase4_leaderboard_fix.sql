-- ============================================================================
-- DESIGNFLOW OS — PHASE 4 (010): Allow get_leaderboard to score all designers
-- when called by a designer (shared board shows summary metrics only).
-- Adds internal bypass flag to calculate_designer_score.
-- ============================================================================

create or replace function public.calculate_designer_score(
  p_designer_id uuid,
  p_start date,
  p_end   date,
  p_internal boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role      public.app_role;
  v_total_sub integer;
  v_approved  integer;
  v_avg_rev   numeric;
  v_on_time   numeric;
  v_output_raw numeric;
  v_accepted  integer;
  v_completed integer;
  v_ack_total integer;
  v_ack_fast  integer;
  v_quality   numeric;
  v_ontime    numeric;
  v_output    numeric;
  v_reliab    numeric;
  v_respons   numeric;
  v_total     numeric;
  v_eligible  boolean;
begin
  v_role := public._caller_role();
  -- Skip per-designer restriction for internal calls from get_leaderboard
  -- (the shared board only exposes summary metrics, per the spec).
  if not p_internal then
    if v_role = 'designer' and p_designer_id <> auth.uid() then
      raise exception 'Designers may only view their own score.';
    end if;
    if v_role = 'team_lead' then
      perform 1 from public.tasks t
       where (t.created_by = auth.uid() or t.assigned_lead_id = auth.uid())
         and (t.assigned_designer_id = p_designer_id or t.claimed_by = p_designer_id)
       limit 1;
      if not found then raise exception 'Designer is outside your authorized scope.'; end if;
    end if;
    if v_role not in ('designer','team_lead','organizer','social_media_manager') then
      raise exception 'Not authorized.';
    end if;
  end if;

  select count(*), count(*) filter (where status = 'approved')
    into v_total_sub, v_approved
    from public.task_submissions
   where designer_id = p_designer_id
     and submitted_at::date between p_start and p_end;

  select coalesce(avg(c.cnt), 0) into v_avg_rev from (
    select s.id, count(rr.id) as cnt
      from public.task_submissions s
      left join public.revision_requests rr on rr.submission_id = s.id
     where s.designer_id = p_designer_id
       and s.submitted_at::date between p_start and p_end
     group by s.id) c;

  select coalesce(avg(case when s.submitted_at <= t.due_date then 1.0 else 0.0 end), 0) * 100
    into v_on_time
    from public.task_submissions s join public.tasks t on t.id = s.task_id
   where s.designer_id = p_designer_id
     and s.submitted_at::date between p_start and p_end
     and t.due_date is not null;

  select coalesce(sum(w.weight), 0) into v_output_raw
    from public.task_submissions s
    join public.tasks t on t.id = s.task_id
    left join public.task_complexity_weights w
      on lower(w.difficulty) = lower(coalesce(t.difficulty, 'medium'))
   where s.designer_id = p_designer_id and s.status = 'approved'
     and s.submitted_at::date between p_start and p_end;

  select count(*) into v_accepted
    from public.tasks
   where (assigned_designer_id = p_designer_id or claimed_by = p_designer_id)
     and created_at::date between p_start and p_end;

  select count(*) into v_completed
    from public.tasks
   where (assigned_designer_id = p_designer_id or claimed_by = p_designer_id)
     and production_status = 'published'
     and created_at::date between p_start and p_end;

  select count(*),
         count(*) filter (where status = 'accepted' and responded_at is not null
                          and responded_at <= created_at + interval '24 hours')
    into v_ack_total, v_ack_fast
    from public.task_assignments
   where assignee_id = p_designer_id
     and created_at::date between p_start and p_end;

  v_eligible := v_total_sub >= 3;

  v_quality := greatest(coalesce(v_approved::numeric / nullif(v_total_sub, 0), 0) * 100 - least(v_avg_rev * 10, 40), 0);
  v_ontime  := coalesce(v_on_time, 0);
  v_output  := least(coalesce(v_output_raw, 0) / 10 * 100, 100);
  v_reliab  := coalesce(v_completed::numeric / nullif(v_accepted, 0), 0) * 100;
  v_respons := coalesce(v_ack_fast::numeric / nullif(v_ack_total, 0), 0) * 100;
  v_total   := round(0.30 * v_quality + 0.25 * v_ontime + 0.20 * v_output
                   + 0.15 * v_reliab + 0.10 * v_respons, 1);

  return jsonb_build_object(
    'designer_id', p_designer_id,
    'period_start', p_start, 'period_end', p_end,
    'eligible', v_eligible,
    'quality', round(v_quality, 1), 'on_time', round(v_ontime, 1),
    'output', round(v_output, 1), 'reliability', round(v_reliab, 1),
    'responsiveness', round(v_respons, 1),
    'total_score', case when v_eligible then v_total else null end,
    'sample_tasks', v_total_sub
  );
end
$$;

-- get_leaderboard now passes p_internal := true.
create or replace function public.get_leaderboard(
  p_start date,
  p_end   date,
  p_limit integer default 20
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := public._caller_role();
  v_uid  uuid := auth.uid();
  out    jsonb;
begin
  if v_role is null then raise exception 'Not authenticated.'; end if;

  with designers as (
    select distinct s.designer_id as id
      from public.task_submissions s
     where s.submitted_at::date between p_start and p_end
       and (v_role = 'organizer'
            or (v_role = 'team_lead' and exists (
                  select 1 from public.tasks t
                   where t.id = s.task_id
                     and (t.created_by = v_uid or t.assigned_lead_id = v_uid)))
            or (v_role in ('designer','social_media_manager')))
  ),
  scores as (
    select d.id, public.calculate_designer_score(d.id, p_start, p_end, true) as sc
      from designers d
  )
  select jsonb_agg(row order by (row->>'rank')::int) into out from (
    select jsonb_build_object(
             'rank', row_number() over (order by (sc->>'total_score')::numeric desc nulls last),
             'designer_id', s.id,
             'designer_name', p.full_name,
             'score', sc
           ) as row
      from scores s join public.profiles p on p.id = s.id
     where (sc->>'eligible')::boolean
     order by (sc->>'total_score')::numeric desc nulls last
     limit p_limit
  ) ranked;

  return coalesce(out, '[]'::jsonb);
end
$$;

grant execute on function public.calculate_designer_score(uuid, date, date, boolean) to authenticated;
