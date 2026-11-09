# YVRewards

Independent, invitation-only brand-video research platform using React 19, TypeScript, Vite, Supabase and Vercel.

**Source and infrastructure isolation:** Work only in `bysalomon/yrewards`, Supabase project `zbchamxgnddeiktdxljo`, and the Vercel project `yrewards`. Do **not** modify `bysalomon/voicetask` or `voicetask-staging`.

## Production URL and routes

- Website: https://yrewards.vercel.app
- Member dashboard: https://yrewards.vercel.app/app
- Daily video research: `/app/tasks/:day`
- Member Club course catalogue: https://yrewards.vercel.app/app/club
- Member Club course detail: `/app/club/:courseId`
- My Profile: https://yrewards.vercel.app/app/profile
- Settings: https://yrewards.vercel.app/app/settings
- Administration (MFA required): https://yrewards.vercel.app/admin
- Administrator authenticator: https://yrewards.vercel.app/admin/mfa

## Product features

- **Branding:** use only the supplied logo image `https://i.imgur.com/Sf3e6O7.png` — no added wordmark. Premium italic red-gradient headline and backgrounds in `#000000`, `#262324` and `#FD2F33`. White is used primarily for typography. Landing hero retains the supplied CloudFront motion video.
- **Invitation-only accounts:** admin creates one-use, 7-day tokens. Invited people select username, first name, surname and password; signup does not require confirmation email. Public signup must stay disabled. Login is by username or administrator email; lost-password recovery for username-only accounts needs manual handling.
- **Member dashboard:** wallet balance, review count, research status, authorised-video hours and member level, plus 30 days of research cards in 8/8/8/6 pagination. No public or admin ranking.
- **Daily research:** up to **five videos per day**, ordered by slot. One main video and a lateral sequential playlist, adapted from the Member Club visual reference. First unreviewed task is selected; on submitting one positive/negative evaluation the next research brief becomes available. Next day opens **24 hours after the final active review**; the cycle repeats after Day 30.
- **YouTube-only admin inputs:** publish a task with only a valid YouTube URL, title, brand, day, order, independent preparation time and USD evaluation reward. No external MP4 file is required. Existing credits and wallet ledger are preserved by migration.
- **YouTube playback rules:** YouTube embeds are optional references, not paid views. The server-side minimum time for YouTube-only tasks is an **independent research-preparation period** starting when the task is opened. The code never relies on YouTube player watch time to release a payment. Brand feedback is one reward per task and cycle. See compliance note below.
- **Member Club:** course catalogue with a dark-red hero and horizontal gallery of vertical 9:16 course covers; clicking a course opens its own 16:9 player and module/lesson playlist. Unlimited modules per course and YouTube videos per module (no 200-slot legacy limit), with per-member lesson completion. Three original reading guides remain in the migrated **YVRewards Essentials** course. Administrators manage everything in three steps (course with cover upload/crop → modules → YouTube lessons) without editing SQL. Member Club lessons are not remunerated.
- **My Profile:** account summary, editable full name, permanent username, member since, research stats and wallet summary.
- **Settings:** password changes and account-level persisted preferences for motion, compact cards and research tips. Admin MFA remains mandatory for privileged work.
- **Wallet:** USD, scheduled withdrawal request days anchored to signup date, maximum four per calendar month, minimum $250, manual KYC for first withdrawal, staff-approved destination and staff-controlled payment review with actual transaction reference.

## YouTube compliance constraint

YouTube API Services developer policies prohibit compensating users for directly or indirectly watching embedded YouTube videos. Documentation: https://developers.google.com/youtube/terms/developer-policies/

Therefore YVRewards pays for independent research feedback **not YouTube playback**, uses a separate research-preparation timer that does not inspect the iframe, and does not require viewers to play or engage with the embedded YouTube video to earn an evaluation reward. The main YouTube player is an optional creative reference. The application is independent of YouTube; avoid claiming a partnership or buying view engagement. Verify copyright, YouTube terms, advertising and local research-law requirements before public rollout.

## Infrastructure

- GitHub: `bysalomon/yrewards` (main)
- Supabase: `zbchamxgnddeiktdxljo` (isolated from VoiceTask)
- Vercel: `yrewards` (linked to GitHub, deployed from main)
- Supabase migrations applied:
  - `202611080001_initial.sql`
  - `202611080002_security_hardening.sql`
  - `202611080003_admin_bootstrap.sql`
  - `202611090001_research_club_experience.sql`
  - `202611090002_member_club_onboarding.sql`
  - `202611090003_academy_courses.sql`
  - `202611090004_module_title_width.sql`
- Edge Functions active: `accept-invite` and `create-invite`. The service-role key must stay on the Supabase server, **never** in a Vite, GitHub or Vercel public environment variable.
- Vercel variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` point only to YVRewards Supabase.

## Local development and automated tests

```sh
npm install
npm run dev
npm run build
npm test
```

GitHub Actions builds TypeScript/Vite, runs the unit tests and applies **all five migrations** to an isolated PostgreSQL 17 instance before running SQL tests. Checks cover the payout calendar, day unlocking, single wallet credit, five-slot validation, sequential reviews, independent preparation timer, Member Club progress, nested course/module architecture with legacy progress preservation, 200+ video ordering, extended module names, profile changes and saved preferences.

The repository does not yet include a reproducible `package-lock.json` or real browser E2E automation. Before a broad launch, add these and exercise invitation, user registration, task research, club progress, KYC and actual staff payout in the hosted environment.

## Operational cautions

An administrator account with verified TOTP and one real invited member were previously created. They remain intact. Existing US$25 reward transactions are preserved. New YouTube-only research flows are schema-tested on PostgreSQL but **have not been verified by a complete hosted-user browser checkout**; do not conflate build success with E2E certification.

Before scaling to real payouts: verify public signup stays disabled, enable leaked-password protection in Supabase Auth, review database security advisor warnings for intentionally exposed authenticated `SECURITY DEFINER` RPCs, publish country-appropriate terms and privacy policies, verify actual media rights, define fraud controls, ID retention, account recovery and support procedures, and test the manual payout workflow with an actual approved transaction.

**VoiceTask remains entirely unchanged by these tasks.**

## November 9, 2026 academy refresh

- Landing hero background changed to the user-supplied Pexels MP4, retaining dark fade/overlay.
- Fixed invisible pagination controls with explicit dark/red styles and page-number buttons.
- 24-hour unlock countdown refreshes each second, with distinct red pulse animation.
- Mobile member topbar displays only the official YVRewards logo next to the menu.
- Member Club course editor automatically crops uploaded JPEG/PNG/WebP cover artwork to 720×1280 portrait, stores the public image in a separate **club-covers** bucket, and keeps identity-document storage private and unrelated.
- Access rules: only MFA-verified administrators can create/edit courses, modules, lessons and upload covers; members can view published material and mark their own lesson progress.
- Existing course has **no portrait image yet** because it was migrated from text guides. Add one in **Admin → Member Club → Edit course**. No fictional cover art or fake courses were inserted.
- Post-change verification: SQL migration applied to YRewards-only Supabase, PostgreSQL CI passed, Vercel production deployment READY. A browser-based test while logged in as the administrator or a member remains a recommended final acceptance check.
