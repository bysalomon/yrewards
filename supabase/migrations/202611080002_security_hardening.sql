-- YRewards live database hardening (isolated from VoiceTask)
revoke all on function public.initialise_member() from public, anon, authenticated;
alter policy profiles_read on public.profiles using (id=(select auth.uid()) or public.admin_with_mfa());
alter policy wallets_read on public.wallet_accounts using (user_id=(select auth.uid()) or public.admin_with_mfa());
alter policy ledger_read on public.wallet_ledger using (user_id=(select auth.uid()) or public.admin_with_mfa());
alter policy watch_read on public.video_watch_sessions using (user_id=(select auth.uid()) or public.admin_with_mfa());
alter policy feedback_read on public.video_feedback using (user_id=(select auth.uid()) or public.admin_with_mfa());
alter policy days_read on public.day_completions using (user_id=(select auth.uid()) or public.admin_with_mfa());
alter policy destination_read on public.payout_destinations using (user_id=(select auth.uid()) or public.admin_with_mfa());
alter policy identity_read on public.identity_verifications using (user_id=(select auth.uid()) or public.admin_with_mfa());
alter policy withdrawal_read on public.withdrawals using (user_id=(select auth.uid()) or public.admin_with_mfa());
