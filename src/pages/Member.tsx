import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {Link,Outlet,useLocation,useNavigate} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BookOpen,Check,CheckCircle2,Clock3,FileCheck2,Heart,LayoutDashboard,LockKeyhole,LogOut,Menu,Play,Settings2,ShieldAlert,ShieldCheck,UserRound,Video,Wallet as WalletIcon,X} from 'lucide-react';
import {useAuth} from '../AuthContext';
import {Brand} from './Landing';
import {supabase,money,fmt,waitLabel,describeError,type Task,type Day,type Feedback,type Profile,type WalletAccount,type PayoutSchedule,type Withdrawal,type Destination,type Identity} from '../lib';
type Progress={user_id:string;cycle_number:number;day_number:number;completed_at:string};
type Watch={video_id:string;cycle_number:number;played_seconds:number};
type MemberData={profile:Profile|null;wallet:WalletAccount|null;day:Day;tasks:Task[];feedback:Feedback[];completions:Progress[];watches:Watch[]};
export function useMemberData(){
 const {user}=useAuth();const [data,setData]=useState<MemberData|null>(null);
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const refresh=useCallback(async()=>{
  if(!user)return;
  try{
   setError('');
   const [p,w,d,t,f,c,wat]=await Promise.all([
    supabase.from('profiles').select('*').eq('id',user.id).maybeSingle(),
    supabase.from('wallet_accounts').select('*').eq('user_id',user.id).maybeSingle(),
    supabase.rpc('my_current_day').single(),
    supabase.from('video_tasks').select('*').eq('active',true).order('day_number').order('slot'),
    supabase.from('video_feedback').select('*').eq('user_id',user.id),
    supabase.from('day_completions').select('*').eq('user_id',user.id),
    supabase.from('video_watch_sessions').select('video_id,cycle_number,played_seconds').eq('user_id',user.id)]);
   for(const x of [p,w,d,t,f,c,wat])if(x.error)throw x.error;
   setData({profile:p.data as Profile|null,wallet:w.data as WalletAccount|null,
    day:d.data as Day,tasks:(t.data||[]) as Task[],feedback:(f.data||[]) as Feedback[],
    completions:(c.data||[]) as Progress[],watches:(wat.data||[]) as Watch[]});
  }catch(e){setError(describeError(e))}finally{setLoading(false)}
 },[user]);
 useEffect(()=>{void refresh()},[refresh]);
 return {data,loading,error,refresh};
}
export function MemberLayout({adminArea=false}:{adminArea?:boolean}){
 const {user,profile,admin,signOut}=useAuth();const [open,setOpen]=useState(false);
 const loc=useLocation();const navigate=useNavigate();
 useEffect(()=>{
  if(!user)return;
  let active=true;
  async function applyPreferences(){
   const {data}=await supabase.from('member_preferences').select('reduced_motion,compact_cards').eq('user_id',user?.id).maybeSingle();
   if(!active)return;
   document.body.classList.toggle('prefReducedMotion',Boolean(data?.reduced_motion));
   document.body.classList.toggle('prefCompact',Boolean(data?.compact_cards));
  }
  void applyPreferences();
  window.addEventListener('yrewards:preferences-updated',applyPreferences);
  return()=>{active=false;window.removeEventListener('yrewards:preferences-updated',applyPreferences);
   document.body.classList.remove('prefReducedMotion','prefCompact')};
 },[user]);
 const nav=adminArea?[{path:'/admin',label:'Administration',icon:ShieldCheck},{path:'/app',label:'Member workspace',icon:LayoutDashboard}]:
 [{path:'/app',label:'Dashboard',icon:LayoutDashboard},{path:'/app/club',label:'Member Club',icon:BookOpen},{path:'/app/profile',label:'My Profile',icon:UserRound},{path:'/app/settings',label:'Settings',icon:Settings2},{path:'/app/wallet',label:'Wallet & payments',icon:WalletIcon}];
 const leave=async()=>{await signOut();navigate('/')};
 return <div className="workspace">
  {open&&<button className="sideShade" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}
  <aside className={'sidebar '+(open?'show':'')}>
   <div className="sideBrand"><Link to="/" onClick={()=>setOpen(false)}><Brand/></Link><button className="mobileClose" onClick={()=>setOpen(false)}><X/></button></div>
   <div className="sideCaption">YREWARDS · {adminArea?'STAFF':'MEMBERS'}</div>
   <nav className="sideNav">{nav.map(({path,label,icon:Icon})=><Link key={path} onClick={()=>setOpen(false)} className={loc.pathname===path?'active':''} to={path}><Icon size={19}/>{label}</Link>)}
    {!adminArea&&<Link className={loc.pathname.startsWith('/app/tasks')?'active':''} to="/app" onClick={()=>setOpen(false)}><Video size={19}/> Video Tasks</Link>}
    {admin&&!adminArea&&<Link to="/admin" onClick={()=>setOpen(false)}><ShieldCheck size={19}/> Administration</Link>}
   </nav>
   <div className="sideBottom"><div className="miniProfile"><div className="avatar">{profile?.username?.[0]?.toUpperCase()||'Y'}</div><div><strong>{profile?.full_name||'Member'}</strong><small>@{profile?.username||'member'}</small></div></div>
   <button className="logout" onClick={()=>void leave()}><LogOut size={16}/> Sign out</button></div>
  </aside>
  <div className="workBody"><header className="topbar"><button className="hamburger" aria-label="Open menu" onClick={()=>setOpen(true)}><Menu/></button>
   <span className="breadcrumb">YRewards <span>/</span> {adminArea?'Administration':'My workspace'}</span>
   <div className="topRight"><span className="onlineDot"/> <span className="topPresence">Research member</span><div className="avatar small">{profile?.username?.[0]?.toUpperCase()||'Y'}</div></div>
  </header><main className="page"><Outlet/></main></div>
 </div>
}
export function Dashboard(){
 const {data,loading,error,refresh}=useMemberData();const [page,setPage]=useState(1);
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer)},[]);
 if(loading)return <div className="loading">Loading your YRewards workspace…</div>;
 if(error||!data)return <div className="error">Could not load your workspace. {error}<button onClick={()=>void refresh()}>Try again</button></div>;
 const {day,wallet,feedback,tasks,completions,profile,watches}=data;
 const allWatched=watches.reduce((a,w)=>a+Number(w.played_seconds),0);
 const levels=[['Starter',0],['Explorer',3600],['Insider',14400],['Expert',36000],['Elite',90000]] as const;
 const level=levels.filter(([,seconds])=>allWatched>=seconds).at(-1)?.[0]||'Starter';
 const eligible=now>=new Date(day.unlocks_at).getTime();
 const completedCount=feedback.length;
 const cards=[{name:'Wallet balance',value:money(wallet?.available_cents),caption:'Approved rewards available',icon:WalletIcon,href:'/app/wallet'},
  {name:'Completed tasks',value:String(completedCount),caption:'Video evaluations submitted',icon:CheckCircle2,href:'/app'},
  {name:'Hours watched',value:(allWatched/3600).toFixed(2)+' h',caption:'Authorised-video playback (not YouTube)',icon:Clock3,href:'/app'},
  {name:'Account level',value:level,caption:'Research contributor status',icon:Heart,href:'/app'}];
 return <><div className="pageHead"><div><span className="eyebrow">YOUR PERSONAL WORKSPACE</span><h1>Welcome back, {profile?.full_name.split(' ')[0]||'member'} <span className="redAccent">.</span></h1>
 <p>Watch approved brand content, share what you think and grow your research rewards.</p></div>
 <Link to="/app/wallet" className="button btnRed"><WalletIcon size={17}/> View my wallet <ArrowRight size={17}/></Link></div>
 <section className="statGrid">{cards.map(({name,value,caption,icon:Icon,href})=><Link to={href} className="statCard" key={name}>
  <div className="statTop"><span>{name}</span><Icon size={19}/></div><strong>{value}</strong><small>{caption}</small></Link>)}</section>
 <div className="sectionHead"><div><span className="eyebrow">THE 30-DAY EXPERIENCE</span><h2>Daily video tasks</h2><p>One day at a time. Real feedback. Clear rewards.</p></div><span className="sectionCounter">CYCLE {String(day.cycle_number).padStart(2,'0')}</span></div>
 <div className="noticeBanner"><ShieldCheck size={21}/><div><strong>Your tasks restart after Day 30.</strong><span>Complete all 30 days to begin a new cycle. Each next day unlocks 24 hours after the previous day is completed.</span></div></div>
 <div className="dayGrid">{Array.from({length:30},(_,i)=>i+1).slice((page-1)*8,page*8).map(n=>{
  const done=completions.some(c=>c.cycle_number===day.cycle_number&&c.day_number===n);
  const present=tasks.filter(t=>t.day_number===n);
  const reviewed=feedback.filter(f=>f.cycle_number===day.cycle_number&&f.day_number===n).length;
  const current=n===day.day_number;
  const unlocked=current&&eligible;
  const locked=!done&&!unlocked;
  const label=done?'Completed':locked?(current?'Unlocking soon':'Locked'):(present.length?'Available now':'Awaiting videos');
  return <Link className={'dayCard '+(locked?'locked ':'')+(done?'done ':'')+(unlocked?'current ':'')}
   to={unlocked&&present.length?'/app/tasks/'+n:'/app'} key={n} onClick={e=>{if(!unlocked||!present.length)e.preventDefault()}}>
   <div className="dayCardHeader"><span className="dayIcon">{done?<Check size={20}/>:locked?<LockKeyhole size={19}/>:<Play size={20}/>}</span><span className={'statusPill '+(unlocked?'open':'')}>{label}</span></div>
   <span className="dayLabel">DAY {String(n).padStart(2,'0')}</span>
   <h3>{n===30?'Final review day':n===1?'Your first impressions':'Daily brand reviews'}</h3>
   <p>{current&&!eligible?waitLabel(day.unlocks_at):present.length+' '+(present.length===1?'video':'videos')+' · '+money(present.reduce((a,t)=>a+t.reward_cents,0))+' total'}</p>
   <div className="dayCardFooter">{done?present.length+' videos reviewed':unlocked?reviewed+' of '+present.length+' reviewed':'Complete previous days'} <ArrowRight size={18}/></div>
  </Link>})}</div>
 <div className="pagination"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}><ArrowLeft size={16}/> Previous</button><span>Page {page} of 4</span>
 <button disabled={page===4} onClick={()=>setPage(p=>p+1)}>Next <ArrowRight size={16}/></button></div>
 <div className="disclaimerPanel"><ShieldAlert size={20}/><p>YVRewards is independent of YouTube. YouTube embeds are optional references, and rewards are only for eligible research feedback — never for viewing, liking or other YouTube engagement.</p></div>
 </>;
}
export function WalletPage(){
 const {user}=useAuth();const [schedule,setSchedule]=useState<PayoutSchedule|null>(null);
 const [wallet,setWallet]=useState<WalletAccount|null>(null);
 const [destinations,setDestinations]=useState<Destination[]>([]);
 const [identities,setIdentities]=useState<Identity[]>([]);
 const [withdrawals,setWithdrawals]=useState<Withdrawal[]>([]);
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const [destinationMethod,setDestinationMethod]=useState('paypal');const [destinationValue,setDestinationValue]=useState('');
 const [selected,setSelected]=useState('');const [cents,setCents]=useState('');
 const reload=useCallback(async()=>{
  if(!user)return;try{
   const [s,w,d,i,x]=await Promise.all([
    supabase.rpc('my_withdrawal_schedule'),
    supabase.from('wallet_accounts').select('*').eq('user_id',user.id).maybeSingle(),
    supabase.from('payout_destinations').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),
    supabase.from('identity_verifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),
    supabase.from('withdrawals').select('*').eq('user_id',user.id).order('requested_at',{ascending:false})]);
   for(const r of [s,w,d,i,x])if(r.error)throw r.error;
   setSchedule(s.data as PayoutSchedule);setWallet(w.data as WalletAccount|null);
   setDestinations((d.data||[]) as Destination[]);setIdentities((i.data||[]) as Identity[]);
   setWithdrawals((x.data||[]) as Withdrawal[]);
  }catch(e){setError(describeError(e))}finally{setLoading(false)}
 },[user]);
 useEffect(()=>{void reload()},[reload]);
 const firstWithdrawal=withdrawals.length===0;
 const verified=identities.some(i=>i.status==='verified');
 const pending=identities.some(i=>i.status==='pending');
 async function submitDestination(e:FormEvent){e.preventDefault();setError('');setMessage('');
  const {error}=await supabase.rpc('register_payout_destination',{p_method:destinationMethod,p_details:destinationValue.trim()});
  if(error)setError(error.message);else{setMessage('Destination added. Staff must approve it before withdrawals.');setDestinationValue('');await reload()}
 }
 async function submitKyc(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file||!user)return;
  setError('');setMessage('');
  if(file.size>10485760||!['image/jpeg','image/png','application/pdf'].includes(file.type)){setError('Use PDF, JPG or PNG up to 10 MB.');return}
  const path=user.id+'/'+crypto.randomUUID()+'-'+file.name.replace(/[^a-z0-9.\-_]/gi,'_').slice(-70);
  const upload=await supabase.storage.from('identity-docs').upload(path,file,{contentType:file.type,upsert:false});
  if(upload.error){setError(upload.error.message);return}
  const submitted=await supabase.rpc('request_identity_review',{p_path:path});
  if(submitted.error)setError(submitted.error.message);
  else{setMessage('ID document submitted for staff verification.');await reload()}
 }
 async function withdraw(e:FormEvent){e.preventDefault();setError('');setMessage('');
  const amount=Math.round(Number(cents)*100);
  if(!Number.isFinite(amount)||amount<25000){setError('Enter at least $250.00.');return}
  const {error}=await supabase.rpc('request_withdrawal',{p_cents:amount,p_destination:selected});
  if(error)setError(error.message);else{setMessage('Withdrawal request received. Your team will process the transfer manually.');setCents('');await reload()}
 }
 if(loading)return <div className="loading">Loading your wallet…</div>;
 const isWindow=Boolean(schedule?.eligible);
 return <><div className="pageHead"><div><span className="eyebrow">YOUR EARNINGS</span><h1>Wallet & withdrawals <span className="redAccent">.</span></h1>
 <p>Track every completed research reward and manage your scheduled payouts.</p></div></div>
 <div className="walletHero"><div><span className="eyebrow">AVAILABLE TO WITHDRAW</span><strong>{money(wallet?.available_cents)}</strong><span>Lifetime approved: {money(wallet?.lifetime_cents)} · Pending manual transfer: {money(wallet?.reserved_cents)}</span></div><WalletIcon size={45}/></div>
 <section className="panel"><span className="eyebrow">YOUR PERSONAL PAYOUT CALENDAR · UTC</span><h2>Four scheduled withdrawal days per month</h2>
 <p className="muted">Your dates are set from your registration day, with seven-day increments adjusted for each month's length. You can submit a maximum of four requests a month, one on each eligible date. The button stays locked on all other days.</p>
 <div className="datesGrid">{(schedule?.dates||[]).map((date,i)=><div className={'dateTile '+(schedule?.is_day&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===new Date().toISOString().slice(0,10)?'dateNow':'')} key={date}>
  <small>WITHDRAWAL {i+1}</small><strong>{new Date(date+'T00:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'})}</strong></div>)}</div>
 <div className={isWindow?'statusNotice available':'statusNotice lockedStatus'}>{isWindow?<><CheckCircle2 size={20}/> Your withdrawal window is open today.</>:<><LockKeyhole size={20}/> Withdrawals are locked until your next eligible date.</>}
 <span>{schedule?.used_this_month||0} of 4 monthly requests used.</span></div></section>
 <div className="walletColumns"><section className="panel"><h2>Payment destinations</h2><p className="muted">PayPal or bank details require approval by our payment team.</p>
 <div className="destinations">{destinations.map(d=><div className="destination" key={d.id}><div><strong>{d.method==='paypal'?'PayPal':'Bank transfer'}</strong><small>{d.account_details}</small></div>
 <span className={'statusPill '+(d.verified?'open':'')}>{d.verified?'Verified':'Awaiting approval'}</span></div>)}</div>
 <form onSubmit={e=>void submitDestination(e)} className="stackedForm">
 <label>Payment method<select value={destinationMethod} onChange={e=>setDestinationMethod(e.target.value)}><option value="paypal">PayPal</option><option value="bank">Bank transfer</option></select></label>
 <label>{destinationMethod==='paypal'?'PayPal email':'Bank account / IBAN details'}<input value={destinationValue} required minLength={5} onChange={e=>setDestinationValue(e.target.value)}/></label>
 <button className="button btnDark">Add payment destination <ArrowRight size={16}/></button></form></section>
 <section className="panel"><h2>Request a withdrawal</h2><p className="muted">Transfers are processed manually. Withdrawals can only be requested on your personal payment days.</p>
 {isWindow?<>{firstWithdrawal&&!verified?<div className="idVerify"><span className="eyebrow"><FileCheck2 size={16}/> FIRST WITHDRAWAL</span><h3>Identity verification required</h3>
 <p>Before your first withdrawal, submit a government-issued ID for manual verification.</p>
 {pending?<p className="statusNotice">Your document is being reviewed by our team.</p>:<label className="fileUpload">Upload your ID (PDF, JPG or PNG)<input type="file" accept=".pdf,image/png,image/jpeg" onChange={e=>void submitKyc(e)}/></label>}</div>:
 <form className="stackedForm" onSubmit={e=>void withdraw(e)}><label>Amount in USD<input type="number" step="0.01" min="250" max={((wallet?.available_cents||0)/100).toFixed(2)} value={cents} onChange={e=>setCents(e.target.value)} placeholder="0.00" required/></label>
 <label>Approved destination<select value={selected} required onChange={e=>setSelected(e.target.value)}><option value="">Select an approved destination</option>
 {destinations.filter(d=>d.verified).map(d=><option value={d.id} key={d.id}>{d.method==='paypal'?'PayPal':'Bank'} — {d.account_details}</option>)}</select></label>
 <button className="button btnRed wide" disabled={!destinations.some(d=>d.verified)||(wallet?.available_cents||0)<25000}>Request withdrawal <ArrowRight size={16}/></button></form>}</>:
 <div className="lockedWithdraw"><LockKeyhole size={26}/><strong>Withdrawal unavailable</strong><p>Your withdrawal request button will become available on your next scheduled date.</p><button className="button btnDark wide" disabled>Withdrawal locked</button></div>}
 </section></div>
 <section className="panel"><h2>Withdrawal history</h2>{withdrawals.length?<div className="responsiveTable"><table><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead><tbody>{withdrawals.map(x=><tr key={x.id}><td>{fmt(x.requested_at)}</td><td>{money(x.amount_cents)}</td><td><span className="statusPill">{x.status}</span></td><td>{x.reference||'—'}</td></tr>)}</tbody></table></div>:<p className="muted">No withdrawal requests yet.</p>}</section>
 {error&&<div className="error" role="alert">{error}</div>}{message&&<div className="success" role="status">{message}</div>}
 </>;
}
