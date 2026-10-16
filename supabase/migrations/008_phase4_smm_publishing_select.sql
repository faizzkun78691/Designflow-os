-- ============================================================================
-- DESIGNFLOW OS — PHASE 4 (008): Widen SMM publishing_records SELECT.
--
-- Phase 3 limited SMMs to ready+current handoffs. Phase 4's Publishing Studio
-- needs the SMM to see every current publishing record (any status) plus
-- records they personally managed (history). Writes remain RPC-only.
-- Idempotent.
-- ============================================================================

drop policy if exists "publishing_records_select_smm" on public.publishing_records;
create policy "publishing_records_select_smm" on public.publishing_records
  for select to authenticated using (
    public.current_user_role() = 'social_media_manager'
    and (
      publishing_records.is_current
      or publishing_records.managed_by = auth.uid()
      or publishing_records.published_by = auth.uid()
      or publishing_records.scheduled_by = auth.uid()
    )
  );
