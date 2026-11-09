import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowRight,ArrowUpRight,BadgeCheck,CheckCircle2,ChevronRight,CircleDollarSign,Menu,ShieldCheck,Star,Wallet,X} from 'lucide-react';
const about:Record<string,[string,string[]]>={
 how:['How it works',[
  'YRewards is an independent, invitation-only market-research community. Participating brands commission feedback on authorised promotional video material.',
  'Invited members examine brand creative and submit an independent positive or negative evaluation. Our research helps partners understand what works, refine their communication and improve future advertising experiences.',
  'Rewards are linked to completed, eligible independent research feedback. The programme is not affiliated with, endorsed by or operated by YouTube. Embedded YouTube videos are optional, unpaid references; rewards are not based on their views or player engagement.'
 ]],
 invite:['Receive an invitation',[
  'Membership is invitation-only. Each secure invitation link is valid for one new account and expires after seven days.',
  'Invited participants choose a username and password and provide their first and last name. There is no email-confirmation step. Keep your credentials safe: without a verified email, self-service password recovery is unavailable.'
 ]],
 payments:['Payment methods',[
  'Approved research rewards are credited to your USD wallet. Eligible members can request withdrawals to a staff-approved PayPal or bank destination.',
  'There are up to four scheduled withdrawal dates per calendar month, calculated from your registration date. The request button is available only on those dates. The first withdrawal requires identity verification when the date arrives.',
  'The minimum withdrawal is $250. Payments are processed manually by our team; a request is not a transfer confirmation.'
 ]],
 terms:['Terms of participation',[
  'YRewards is an independent market-research service for invited participants aged 18 or older. Members must provide genuine feedback on assigned creative assets.',
  'Each task shows its reward and independent research preparation time in advance. Credits are subject to platform eligibility and fraud-prevention checks. One account per person; do not share invitations or automate activity.',
  'Production launch requires published country-specific programme terms and payment eligibility rules.'
 ]],
 privacy:['Privacy policy',[
  'We collect the account information you submit, video-review responses, research activity and payment/identity information required to operate the service.',
  'Identity documents are stored in private, access-controlled storage for verification only. Brand feedback may be supplied to research clients in aggregated or otherwise appropriately disclosed form.',
  'Production launch requires a final privacy notice explaining retention periods, legal bases, recipients, data rights and contact details.'
 ]],
 setup:['Deployment setup',[
  'Connect YRewards to a separate Supabase project; do not reuse VoiceTask project credentials. Apply the migration in supabase/migrations, deploy accept-invite and create-invite, then configure the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables.',
  'Disable public signups in Supabase Auth. Create an admin user and assign its UUID in public.admin_roles. Enrol and verify TOTP MFA before accessing administrator actions.',
  'Link the yrewards GitHub repository to a separate Vercel project. Before going live, test invited registration, research sessions, KYC, wallet ledger and manual payouts.'
 ]]
};
const content:Record<string,string>={how:'How does it work?',invite:'Receive an invitation',payments:'Payment methods'};
export function Brand(){return <span className="brand"><img src="https://i.imgur.com/Sf3e6O7.png" alt="YVRewards" /></span>}
export function Landing(){
 const [modal,setModal]=useState<string|null>(null);const [menu,setMenu]=useState(false);
 useEffect(()=>{const f=(e:KeyboardEvent)=>{if(e.key==='Escape'){setModal(null);setMenu(false)}};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[]);
 return <div className="landing">
  <video className="heroVideo" autoPlay muted loop playsInline preload="metadata" aria-hidden="true"><source type="video/mp4" src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_112712_da9d53df-6d27-4b12-bdf6-aa9dc2622bdf.mp4"/></video>
  <div className="heroOverlay"/><div className="landingWrap">
   <header className="landingHeader"><Link to="/"><Brand/></Link><nav className={menu?'navLinks open':'navLinks'}>
    {Object.entries(content).map(([key,title])=><button key={key} onClick={()=>{setModal(key);setMenu(false)}}>{title}</button>)}
   </nav><Link className="loginLink" to="/login">Sign in <ArrowUpRight size={17}/></Link>
   <button className="mobileMenu" aria-label="Toggle navigation" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></header>
   <section className="heroMain"><div className="heroCopy"><span className="eyebrow heroEyebrow"><span className="pulse"/> BRAND RESEARCH · REAL REWARDS</span>
     <h1>Get paid to watch<br/>and <em>review videos.</em></h1>
     <p>Help brands make better videos. Explore brand creatives, share your honest feedback and earn rewards for completing independent research assignments.</p>
     <div className="heroButtons"><Link className="button btnRed" to="/login">I ALREADY HAVE AN ACCOUNT <ArrowUpRight size={19}/></Link>
     <button className="button btnGlass" onClick={()=>setModal('invite')}>I NEED AN INVITATION <ChevronRight size={18}/></button></div>
     <div className="heroTrust"><span><BadgeCheck size={17}/> Research-driven rewards</span><span><Wallet size={17}/> USD wallet</span><span><ShieldCheck size={17}/> Invite-only access</span></div>
   </div></section>
   <footer className="heroFooter"><span>INDEPENDENT VIDEO RESEARCH COMMUNITY</span><span>Not affiliated with, endorsed by or operated by YouTube.</span></footer>
  </div>
  {modal&&<div className="modalShade" onMouseDown={()=>setModal(null)}><article className="modalCard" role="dialog" aria-modal="true" aria-label={about[modal][0]} onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={()=>setModal(null)} aria-label="Close"><X/></button><span className="eyebrow">YREWARDS · INFORMATION</span><h2>{about[modal][0]}</h2>{about[modal][1].map(p=><p key={p}>{p}</p>)}<button className="button btnRed" onClick={()=>setModal(null)}>Got it <CheckCircle2 size={17}/></button></article></div>}
 </div>
}
export function InfoPage(){
 const {topic='terms'}=useParams();const entry=about[topic]||about.terms;
 return <div className="infoPage"><div className="infoNav"><Link to="/"><Brand/></Link><Link to="/login">Sign in <ArrowRight size={14}/></Link></div>
 <article className="infoContent"><span className="eyebrow"><Star size={15}/> YREWARDS / INFORMATION</span><h1>{entry[0]}</h1>{entry[1].map(s=><p key={s}>{s}</p>)}<p className="muted"><CircleDollarSign size={15} style={{verticalAlign:'middle'}}/> YRewards is a private brand-feedback service, not a YouTube partner.</p><Link to="/" className="button btnRed">Back to home <ArrowRight size={16}/></Link></article></div>
}
