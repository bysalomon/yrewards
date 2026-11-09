import {useEffect,useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {CalendarDays,CheckCircle2,Clock3,KeyRound,LockKeyhole,Save,Settings2,ShieldCheck,UserRound,Wallet} from 'lucide-react';
import {useAuth} from '../AuthContext';
import {supabase,fmt,money} from '../lib';
type Preferences={user_id:string;reduced_motion:boolean;compact_cards:boolean;show_tips:boolean};
const defaults={reduced_motion:false,compact_cards:false,show_tips:true};
export function MyProfile(){
 const {user,profile,refresh}=useAuth();
 const [name,setName]=useState(profile?.full_name||'');const [busy,setBusy]=useState(false);
 const [counts,setCounts]=useState({reviews:0,lessons:0,seconds:0,balance:0});
 const [notice,setNotice]=useState('');const [error,setError]=useState('');
 useEffect(()=>{setName(profile?.full_name||'')},[profile?.full_name]);
 useEffect(()=>{if(!user)return;let mounted=true;
  void Promise.all([supabase.from('video_feedback').select('id',{count:'exact',head:true}).eq('user_id',user.id),
  supabase.from('club_progress').select('lesson_id',{count:'exact',head:true}).eq('user_id',user.id),
  supabase.from('video_watch_sessions').select('played_seconds').eq('user_id',user.id),
  supabase.from('wallet_accounts').select('available_cents').eq('user_id',user.id).maybeSingle()])
   .then(([a,b,c,d])=>{if(mounted)setCounts({reviews:a.count||0,lessons:b.count||0,seconds:(c.data||[]).reduce((v,w)=>v+Number(w.played_seconds||0),0),balance:d.data?.available_cents||0})});
 return()=>{mounted=false}},[user]);
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');
  const {error}=await supabase.rpc('update_member_name',{p_full_name:name.trim()});
  if(error)setError(error.message);else{await refresh();setNotice('Your profile has been updated successfully.')};setBusy(false);
 }
 return <><div className="pageHead"><div><span className="eyebrow"><UserRound size={15}/> YOUR ACCOUNT</span><h1>My Profile <span className="redAccent">.</span></h1><p>Review your account information, research activity and contribution history.</p></div></div>
  <div className="profileHero panel"><div className="profileBigAvatar">{profile?.username?.[0]?.toUpperCase()||'Y'}</div><div><h2>{profile?.full_name||'Research member'}</h2><p>@{profile?.username} · {profile?.status==='active'?'Active member':'Member'}</p><span><ShieldCheck size={15}/> Private YVRewards account</span></div></div>
  <div className="profileStats"><div className="statCard"><Clock3 size={20}/><strong>{(counts.seconds/3600).toFixed(2)} h</strong><span>Authorised video hours</span></div><div className="statCard"><CheckCircle2 size={20}/><strong>{counts.reviews}</strong><span>Evaluations submitted</span></div><div className="statCard"><CalendarDays size={20}/><strong>{counts.lessons}</strong><span>Club lessons completed</span></div><div className="statCard"><Wallet size={20}/><strong>{money(counts.balance)}</strong><span>Available balance</span></div></div>
  <div className="settingsColumns"><section className="panel"><span className="eyebrow">PERSONAL INFORMATION</span><h2>Edit your name</h2><p className="muted">Your username is your permanent private sign-in identifier.</p><form className="stackedForm" onSubmit={e=>void save(e)}><label>Full name<input required minLength={3} maxLength={120} value={name} onChange={e=>setName(e.target.value)} /></label><label>Username<input value={profile?.username||''} disabled/></label><button disabled={busy} className="button btnRed"><Save size={16}/> Save changes</button>{notice&&<p className="successText">{notice}</p>}{error&&<p className="error">{error}</p>}</form></section>
  <section className="panel"><span className="eyebrow">MEMBERSHIP</span><h2>Account overview</h2><dl className="profileDetails"><div><dt>Member since</dt><dd>{profile?.created_at?fmt(profile.created_at):'—'}</dd></div><div><dt>Account status</dt><dd>{profile?.status||'Active'}</dd></div><div><dt>Account type</dt><dd>Invitation-only member</dd></div><div><dt>Research cycles</dt><dd>30-day recurring programme</dd></div></dl><Link className="button btnOutline" to="/app/settings"><Settings2 size={16}/> Account settings</Link></section></div>
 </>;
}
export function MemberSettings(){
 const {user,admin}=useAuth();
 const [prefs,setPrefs]=useState(defaults);const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');const [error,setError]=useState('');
 const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
 useEffect(()=>{if(!user)return;let active=true;void supabase.from('member_preferences').select('*').eq('user_id',user.id).maybeSingle().then(({data,error})=>{
  if(!active)return;
  if(error)setError(error.message);else if(data)setPrefs({reduced_motion:Boolean((data as Preferences).reduced_motion),compact_cards:Boolean((data as Preferences).compact_cards),show_tips:Boolean((data as Preferences).show_tips)});
 });return()=>{active=false}},[user]);
 useEffect(()=>{document.body.classList.toggle('prefReducedMotion',prefs.reduced_motion);document.body.classList.toggle('prefCompact',prefs.compact_cards);
  return()=>{document.body.classList.remove('prefReducedMotion','prefCompact')}},[prefs]);
 async function savePrefs(){if(!user)return;setSaving(true);setError('');setMessage('');
  const {error}=await supabase.from('member_preferences').upsert({user_id:user.id,...prefs,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error)setError(error.message);else setMessage('Your preferences have been saved.');setSaving(false);
 }
 async function savePassword(e:FormEvent){e.preventDefault();setError('');setMessage('');
  if(password.length<12){setError('Use a password with at least 12 characters.');return}
  if(password!==confirm){setError('Your passwords do not match.');return}
  setSaving(true);
  const {error}=await supabase.auth.updateUser({password});
  if(error)setError(error.message);else{setPassword('');setConfirm('');setMessage('Your password has been changed.')};setSaving(false);
 }
 return <><div className="pageHead"><div><span className="eyebrow"><Settings2 size={15}/> PREFERENCES & SECURITY</span><h1>Settings <span className="redAccent">.</span></h1><p>Personalise your workspace and manage sign-in security.</p></div></div>
  {message&&<p className="successText"><CheckCircle2 size={15}/>{message}</p>}{error&&<p className="error">{error}</p>}
  <div className="settingsColumns"><section className="panel"><span className="eyebrow">WORKSPACE PREFERENCES</span><h2>Display and guidance</h2><p className="muted">Preferences are saved to your account.</p>
  {([['reduced_motion','Reduce interface animations','Limit transitions and animated interface details.'],['compact_cards','Compact task cards','Use denser cards on your dashboard.'],['show_tips','Show research guidance','Keep helpful introductory notices visible.']] as const).map(([key,title,description])=><label className="settingToggle" key={key}><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={prefs[key]} onChange={e=>setPrefs({...prefs,[key]:e.target.checked})}/></label>)}
  <button className="button btnRed" disabled={saving} onClick={()=>void savePrefs()}><Save size={16}/> Save preferences</button></section>
  <section className="panel"><span className="eyebrow"><KeyRound size={15}/> SIGN-IN SECURITY</span><h2>Change your password</h2><p className="muted">Use a unique password that you do not reuse on other websites.</p>
  <form className="stackedForm" onSubmit={e=>void savePassword(e)}><label>New password<input autoComplete="new-password" type="password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm new password<input autoComplete="new-password" type="password" minLength={12} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button className="button btnRed" disabled={saving}><LockKeyhole size={16}/> Update password</button></form>
  {admin&&<div className="securityFoot"><ShieldCheck size={18}/><div><strong>Administrator MFA enabled</strong><p>Extra verification is required before managing invitations and payouts.</p><Link to="/admin/mfa">Verify MFA again</Link></div></div>}
  </section></div>
 </>;
}
