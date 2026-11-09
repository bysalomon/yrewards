-- Ready-to-use Member Club reading lessons, while staff add actual YouTube tutorials.
-- No YouTube watch is required or remunerated to complete a club guide.
alter table public.club_lessons alter column youtube_url drop not null;
insert into public.club_lessons(module_title,title,description,youtube_url,sort_order)
values
 ('Getting started','Welcome to YVRewards',
  'Welcome to your private YVRewards learning space. This is an independent market-research community. Your workspace contains daily research briefs, a USD wallet, your account profile and the Member Club. Begin with the currently available daily task and review each brief before submitting one genuine assessment. YVRewards is not affiliated with YouTube.',null,1),
 ('Getting started','Your first research day',
  'The first day is available after registration. Each day can contain up to five video research briefs, completed in order. Open the current brief, read the creative context and complete the independent preparation period before sending your feedback. A positive or negative response is an evaluation, not a YouTube like or dislike. Each successful assessment is credited once to the wallet. The next day opens 24 hours after the entire previous day is completed.',null,2),
 ('Member essentials','Wallet, verification and payments',
  'Your wallet records the value of completed eligible assessments in US dollars. Withdrawal requests are available only on the four monthly dates calculated from your registration date. The first request requires identity verification and an approved payment destination. Staff process transfers manually; a wallet credit or withdrawal request does not mean money has been transferred. Review the published withdrawal minimum and programme terms before making any request.',null,1)
on conflict(module_title,sort_order) do nothing;