# YRewards

Independent, invitation-only video research and feedback platform built with React 19, Vite, TypeScript and Supabase.

**Safety boundary:** VoiceTask was inspected only as a structural reference. YRewards has its own source, database migration, Edge Functions, design system and intended Vercel deployment. Never reuse the VoiceTask Supabase project, domain, secrets, storage, wallet or configuration.

## Features

- Landing: “Get paid to watch and review videos.” YRewards/YVRewards brand, user-provided logo and CloudFront hero video, charcoal/black/red palette.
- Invitation-only registration: personal one-use link, username, first name, surname, password (minimum 12 characters); **no email verification**. Sign in with username and password. Account recovery requires manual support because no verified email is collected.
- Member dashboard: USD wallet, completed feedback, research hours watched and account level. No ranking for users or staff.
- Thirty daily cards in four pages (8, 8, 8, 6). Day 1 starts unlocked. Completing all active videos on a day unlocks the next day after 24 hours. Completing Day 30 resets the cycle after a further 24 hours.
- Each day has up to 3 brand-authorised videos. Every video has a measured minimum playback time, positive/negative feedback and its own USD reward. Successful feedback creates one wallet ledger entry and credits the wallet directly.
- Withdrawals are limited to four registration-anchored UTC dates per month, one request per date. Members registered on day 1 see days 8/15/22/29. End-of-month dates wrap within shorter months; first-month eligibility requires seven calendar days. Button disabled outside eligibility dates; first-withdrawal ID verification shown only when eligible.
- Staff manually review identity documentation and payment destinations, approve withdrawal requests, mark processing, and mark as paid **only after a real external payment**, recording reference and proof note.
- Admin dashboard (TOTP MFA required): add/edit/disable video tasks, list member activity, review feedback, issue one-use invitations, process identity verification and payouts.

## YouTube restrictions and video-source choice

**YouTube's developer policies prohibit paying for video views made using the YouTube embed API, directly or indirectly.** Thus the rewarded playback path uses a **brand-supplied/authorised HTTPS video asset** (e.g. a licensed CDN-hosted MP4). Admins can also enter a YouTube link for an explicitly optional, *untracked and unrewarded* reference preview. YouTube playback never advances the reward counter. The application is independent and has no affiliation with YouTube.

Client-side video events can be forged. The PostgreSQL RPC enforces rate-limited play progress, a minimum wall-clock duration, locked days, one review per video per cycle and an atomic wallet ledger. These safeguards **do not independently prove human attention**. Before issuing significant rewards, implement fraud detection and stronger server-verifiable playback evidence.

## Activation: do not connect to VoiceTask

1. Create a separate **YRewards Supabase project** in your chosen Supabase organisation. No new project is created by this repository. Review and apply `supabase/migrations/202611080001_initial.sql` **to that separate project only**. Never run it on `voicetask-staging`.
2. Deploy Supabase Edge Functions `accept-invite` (public endpoint, token protected) and `create-invite` (requires authenticated admin MFA). Supabase injects the project-specific `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. **Do not expose service-role keys** to Vite, GitHub or Vercel.
3. In Supabase Auth, disable public signup; allow password-based sign-in. Invited registration calls the admin API with `email_confirm: true`, using a reserved synthetic login alias, so no confirmation email is sent. Make sure your Supabase Auth validation accepts the synthetic alias domain before launch. Password recovery is a manual-only process until a verified recovery channel exists.
4. Create an admin user within this new project's Auth users (with a unique password and valid username/full_name metadata), then in the **YRewards database** insert its Auth UUID into `public.admin_roles`. After signing in with that administrator's real email and password, visit `/admin/mfa` to enrol and verify TOTP.
5. Create a separate Vercel project linked to `bysalomon/yrewards` (Vite preset). Provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from **YRewards Supabase**, not VoiceTask. Use `.env.example` as a guide for local development.
6. Use `/admin` to issue invitation links, register a test member, and add at least one Day 1 video. Paid videos require an independently playable brand-authorised HTTPS URL (not a YouTube URL). Test actual video duration and playback on mobile.
7. Before handling real payments, publish final policies for each target jurisdiction, configure legitimate funding, supported payout destinations, identity-document retention, support contacts, fraud controls, account recovery and staff payment operations.

## Local commands

    npm install
    npm run dev
    npm run build
    npm test

GitHub Actions runs build and unit tests after each push. A lockfile should be generated with npm, reviewed and committed once the first install resolves.

## Operational status

Frontend, schema, Edge Functions and unit tests are **committed as implementation code**, not a verified production system. Dedicated Supabase project, schema application, function deployment, Vercel environment, branded videos, legal notices, admin bootstrap and genuine end-to-end tests are still pending. No VoiceTask state was changed.