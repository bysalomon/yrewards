import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,BadgeCheck,CheckCircle2,ClipboardCopy,FileText,LockKeyhole,Plus,ShieldAlert,ShieldCheck,ThumbsDown,ThumbsUp,Users,Video,Wallet,X} from 'lucide-react';
import {supabase,money,fmt,describeError,youtubeId,type Task,type Profile,type WalletAccount,type Withdrawal,type Destination,type Identity,type Feedback} from '../lib';

type TaskForm={day_number:number;slot:number;brand_name:string;title:string;youtube_url:string;minimum_minutes:string;reward_usd:string;active:boolean};
type ClubLesson={id:string;module_title:string;title:string;description:string;youtube_url:string;sort_order:number;active:boolean};
type ClubForm=Omit<ClubLesson,'id'>&{id?:string};
const initial:TaskForm={day_number:1,slot:1,brand_name:'',title:'',youtube_url:'',minimum_minutes:'1',reward_usd:'1.00',active:true};
const initialClub:ClubForm={module_title:'Getting started',title:'',description:'',youtube_url:'',sort_order:1,active:true};
export function AdminPage(){
 const [allowed,setAllowed]=useState<boolean|null>(null);
 useEffect(()=>{void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({data})=>setAllowed(data?.currentLevel==='aal2'))},[]);
 if(allowed===null)return <div className="loading">Verifying administrator session…</div>;
 if(!allowed)return <div className="emptyState"><LockKeyhole size={30}/><h2>Two-factor verification required</h2>
 <p>Administrator actions require your verified authenticator code.</p><Link to="/admin/mfa" className="button btnRed">Verify TOTP <ArrowRight size={16}/></Link></div>;
 return <AdminContent/>;
}
function AdminContent(){
 const [tab,setTab]=useState<'tasks'|'club'|'members'|'payments'|'invitations'>('tasks');
 const [clubForm,setClubForm]=useState<ClubForm>(initialClub);
 const [lessons,setLessons]=useState<ClubLesson[]>([]);
 const [form,setForm]=useState<TaskForm>(initial);
 const [tasks,setTasks]=useState<Task[]>([]);const [members,setMembers]=useState<Profile[]>([]);
 const [wallets,setWallets]=useState<(WalletAccount&{user_id:string})[]>([]);
 const [reviews,setReviews]=useState<Feedback[]>([]);const [payments,setPayments]=useState<Withdrawal[]>([]);
 const [destinations,setDestinations]=useState<Destination[]>([]);
 const [identity,setIdentity]=useState<Identity[]>([]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const [invite,setInvite]=useState('');const [documentUrl,setDocumentUrl]=useState('');
 const load=useCallback(async()=>{
  const [t,p,w,f,x,d,i,c]=await Promise.all([
   supabase.from('video_tasks').select('*').order('day_number').order('slot'),
   supabase.from('profiles').select('*').order('created_at',{ascending:false}),
   supabase.from('wallet_accounts').select('*'),
   supabase.from('video_feedback').select('*').order('created_at',{ascending:false}).limit(400),
   supabase.from('withdrawals').select('*').order('requested_at',{ascending:false}),
   supabase.from('payout_destinations').select('*'),
   supabase.from('identity_verifications').select('*').order('created_at',{ascending:false}),
   supabase.from('club_lessons').select('*').order('module_title').order('sort_order')]);
  for(const result of [t,p,w,f,x,d,i,c])if(result.error)throw result.error;
  setTasks((t.data||[]) as Task[]);setMembers((p.data||[]) as Profile[]);
  setWallets((w.data||[]) as (WalletAccount&{user_id:string})[]);
  setReviews((f.data||[]) as Feedback[]);setPayments((x.data||[]) as Withdrawal[]);
  setDestinations((d.data||[]) as Destination[]);setIdentity((i.data||[]) as Identity[]);setLessons((c.data||[]) as ClubLesson[]);
 },[]);
 useEffect(()=>{void load().catch(e=>setError(describeError(e)))},[load]);
 const memberName=(id:string)=>members.find(m=>m.id===id)?.full_name||'Unknown member';
 function field<K extends keyof TaskForm>(key:K,value:TaskForm[K]){setForm(old=>({...old,[key]:value}))}
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   const mins=Number(form.minimum_minutes);const amount=Number(form.reward_usd);
   if(!Number.isFinite(mins)||mins<1/6||mins>60)throw Error('Minimum independent research preparation must be between 10 seconds and 60 minutes.');
   if(!Number.isFinite(amount)||amount<0.01||amount>1000)throw Error('Reward must be between $0.01 and $1,000.');
   if(!youtubeId(form.youtube_url))throw Error('Enter a valid YouTube video URL.');
   const body={day_number:form.day_number,slot:form.slot,brand_name:form.brand_name.trim(),
    title:form.title.trim(),youtube_url:form.youtube_url.trim(),
    licensed_video_url:null,
    min_watch_seconds:Math.round(mins*60),reward_cents:Math.round(amount*100),active:form.active};
   const {error}=await supabase.from('video_tasks').upsert(body,{onConflict:'day_number,slot'});
   if(error)throw error;setMessage('Video task saved for Day '+form.day_number+', slot '+form.slot+'.');await load();
  }catch(e){setError(describeError(e))}finally{setBusy(false)}
 }
 function edit(t:Task){setForm({day_number:t.day_number,slot:t.slot,brand_name:t.brand_name,title:t.title,
 youtube_url:t.youtube_url||'',
 minimum_minutes:String(t.min_watch_seconds/60),reward_usd:(t.reward_cents/100).toFixed(2),active:t.active});
 window.scrollTo({top:0,behavior:'smooth'})}
 async function saveClub(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   if(!youtubeId(clubForm.youtube_url))throw Error('A valid YouTube URL is required.');
   const payload={module_title:clubForm.module_title.trim(),title:clubForm.title.trim(),description:clubForm.description.trim(),
    youtube_url:clubForm.youtube_url.trim(),sort_order:clubForm.sort_order,active:clubForm.active};
   const result=clubForm.id?await supabase.from('club_lessons').update(payload).eq('id',clubForm.id):await supabase.from('club_lessons').insert(payload);
   if(result.error)throw result.error;
   setMessage('Member Club lesson saved.');setClubForm(initialClub);await load();
  }catch(e){setError(describeError(e))}finally{setBusy(false)}
 }
 function editClub(lesson:ClubLesson){setClubForm({...lesson});window.scrollTo({top:0,behavior:'smooth'})}
 async function toggleClub(lesson:ClubLesson){setError('');const {error}=await supabase.from('club_lessons').update({active:!lesson.active}).eq('id',lesson.id);
  if(error)setError(error.message);else await load()}
 async function flipTask(t:Task){setError('');const {error}=await supabase.from('video_tasks').update({active:!t.active}).eq('id',t.id);
 if(error)setError(error.message);else await load()}
 async function issueInvite(){setBusy(true);setError('');setInvite('');try{
  const {data,error}=await supabase.functions.invoke('create-invite',{body:{}});
  if(error||data?.error)throw Error(data?.error||error?.message||'Unable to issue invitation');
  setInvite(window.location.origin+'/invitation?token='+String(data.token));
  setMessage('Invitation generated. Copy the one-use link; it expires in seven days.');
 }catch(e){setError(describeError(e))}finally{setBusy(false)}}
 async function approveDoc(x:Identity,approved:boolean){setError('');try{
  const {error}=await supabase.rpc('admin_review_identity',{p_id:x.id,p_approved:approved});
  if(error)throw error;await load()
 }catch(e){setError(describeError(e))}}
 async function openDoc(x:Identity){setError('');setDocumentUrl('');const r=await supabase.storage.from('identity-docs').createSignedUrl(x.document_path,90);
 if(r.error)setError(r.error.message);else setDocumentUrl(r.data.signedUrl)}
 async function verifyDestination(id:string){setError('');const r=await supabase.rpc('admin_approve_destination',{p_id:id});
 if(r.error)setError(r.error.message);else await load()}
 async function process(x:Withdrawal,action:string){setError('');let reference:string|null=null;let note:string|null=null;
  if(action==='paid'){reference=window.prompt('Enter the real payment provider transfer reference:');if(!reference)return;
   note=window.prompt('Enter confirmation note (at least 15 characters) proving manual transfer:');if(!note)return}
  else if(action==='decline'){note=window.prompt('Reason for declining the withdrawal (at least 10 characters):');if(!note)return}
  const {error}=await supabase.rpc('admin_process_withdrawal',{p_id:x.id,p_action:action,p_reference:reference,p_note:note});
  if(error)setError(error.message);else{setMessage('Withdrawal updated: '+action);await load()}
 }
 const metrics=[{label:'Total members',value:String(members.length),icon:Users},
  {label:'Video briefs',value:String(tasks.filter(t=>t.active).length),icon:Video},
  {label:'Research feedback',value:String(reviews.length),icon:ThumbsUp},
  {label:'Unpaid requests',value:String(payments.filter(p=>!['paid','declined'].includes(p.status)).length),icon:Wallet}];
 return <><div className="pageHead"><div><span className="eyebrow">SECURE ADMINISTRATION · MFA PROTECTED</span><h1>YVRewards Control Centre <span className="redAccent">.</span></h1><p>Manage video research, members, invitations and manual payment approvals.</p></div><span className="adminVerified"><ShieldCheck size={17}/> MFA verified</span></div>
 <div className="adminMetrics">{metrics.map(({label,value,icon:Icon})=><div className="statCard" key={label}><div className="statTop"><span>{label}</span><Icon size={18}/></div><strong>{value}</strong></div>)}</div>
 <div className="tabs">{([['tasks','Video tasks'],['club','Member Club'],['members','Members & feedback'],['payments','KYC & payouts'],['invitations','Invitations']] as const).map(([value,label])=><button className={tab===value?'active':''} key={value} onClick={()=>{setTab(value);setError('');setMessage('')}}>{label}</button>)}</div>
 {tab==='tasks'&&<><div className="adminGrid"><section className="panel"><span className="eyebrow"><Plus size={15}/> TASK EDITOR</span><h2>Publish a research video</h2>
 <p className="muted">Configure up to 5 videos on any day, from Day 1 to Day 30. Reward applies separately to each video.</p>
 <form className="stackedForm" onSubmit={e=>void save(e)}>
 <div className="fieldGrid"><label>Day (1–30)<select value={form.day_number} onChange={e=>field('day_number',Number(e.target.value))}>{Array.from({length:30},(_,i)=><option value={i+1} key={i}>Day {i+1}</option>)}</select></label>
 <label>Video order (1–5)<select value={form.slot} onChange={e=>field('slot',Number(e.target.value))}>{[1,2,3,4,5].map(i=><option key={i} value={i}>Video {i}</option>)}</select></label></div>
 <label>Brand name<input required maxLength={90} value={form.brand_name} onChange={e=>field('brand_name',e.target.value)} placeholder="Brand or campaign"/></label>
 <label>Task title<input required maxLength={160} value={form.title} onChange={e=>field('title',e.target.value)} placeholder="What should reviewers evaluate?"/></label>
 <label>YouTube video URL<input type="url" required value={form.youtube_url} onChange={e=>field('youtube_url',e.target.value)} placeholder="https://www.youtube.com/watch?v=..."/></label>
 {youtubeId(form.youtube_url)&&<div className="adminVideoPreview"><img src={'https://i.ytimg.com/vi/'+youtubeId(form.youtube_url)+'/hqdefault.jpg'} alt="YouTube video thumbnail preview"/><div><strong>YouTube video detected</strong><small>Embed preview will be shown in the member's task. No separate MP4 link is needed.</small></div></div>}
 <div className="fieldGrid"><label>Minimum independent research time (minutes)<input required type="number" min="0.1667" max="60" step="0.01667" value={form.minimum_minutes} onChange={e=>field('minimum_minutes',e.target.value)}/></label>
 <label>Reward for this evaluation (USD)<input required type="number" min="0.01" max="1000" step="0.01" value={form.reward_usd} onChange={e=>field('reward_usd',e.target.value)}/></label></div>
 <label className="checkLabel"><input type="checkbox" checked={form.active} onChange={e=>field('active',e.target.checked)}/> Publish task for invited members</label>
 <button className="button btnRed wide" disabled={busy}>{busy?'Saving…':'Save video task'} <ArrowRight size={16}/></button></form>
 <p className="finePrint"><ShieldAlert size={15}/> The YouTube embed is a reference for your campaign. Research rewards are for submitted assessments; no reward or timer is tied to views or player engagement.</p></section>
 <section className="panel"><h2>Current video catalogue</h2>{!tasks.length?<p className="muted">No videos configured yet. Add your first task to unlock Day 1 content.</p>:
 <div className="catalogue">{tasks.map(t=><div className="catalogueItem" key={t.id}><div><span className="eyebrow">DAY {t.day_number} · VIDEO {t.slot} · {t.brand_name.toUpperCase()}</span>
 <strong>{t.title}</strong><small>{t.min_watch_seconds}s research · {money(t.reward_cents)} · {t.active?'Active':'Hidden'}</small></div>
 <div><button className="smallAction" onClick={()=>edit(t)}>Edit</button><button className="smallAction" onClick={()=>void flipTask(t)}>{t.active?'Disable':'Enable'}</button></div></div>)}</div>}</section></div></>}
 {tab==='club'&&<div className="adminGrid"><section className="panel"><span className="eyebrow">MEMBER CLUB · COURSE EDITOR</span><h2>{clubForm.id?'Edit a lesson':'Publish a video lesson'}</h2><p className="muted">Organise member tutorials into modules. Club lessons never pay rewards.</p>
 <form className="stackedForm" onSubmit={e=>void saveClub(e)}>
  <label>Module name<input minLength={2} maxLength={80} required value={clubForm.module_title} onChange={e=>setClubForm(f=>({...f,module_title:e.target.value}))} placeholder="Getting started"/></label>
  <label>Lesson title<input minLength={3} maxLength={140} required value={clubForm.title} onChange={e=>setClubForm(f=>({...f,title:e.target.value}))} placeholder="How to use YVRewards"/></label>
  <label>YouTube lesson URL<input required type="url" value={clubForm.youtube_url} onChange={e=>setClubForm(f=>({...f,youtube_url:e.target.value}))} placeholder="https://www.youtube.com/watch?v=..."/></label>
  <label>Lesson description<textarea rows={4} maxLength={1500} value={clubForm.description} onChange={e=>setClubForm(f=>({...f,description:e.target.value}))} placeholder="Explain what this lesson teaches."/></label>
  <label>Position in module<input type="number" required min={1} max={200} value={clubForm.sort_order} onChange={e=>setClubForm(f=>({...f,sort_order:Number(e.target.value)}))}/></label>
  <label className="checkLabel"><input type="checkbox" checked={clubForm.active} onChange={e=>setClubForm(f=>({...f,active:e.target.checked}))}/> Published and visible to members</label>
  <button className="button btnRed wide" disabled={busy}><Plus size={17}/> {clubForm.id?'Save changes':'Add lesson'}</button>
  {clubForm.id&&<button className="button btnOutline wide" type="button" onClick={()=>setClubForm(initialClub)}>Cancel editing</button>}
 </form></section>
 <section className="panel"><h2>Published lessons</h2>{!lessons.length?<p className="muted">No Member Club lessons yet. Add your first YouTube lesson on the left.</p>:<div className="catalogue">{lessons.map(l=><div key={l.id} className="catalogueItem"><div><span className="eyebrow">{l.module_title} · LESSON {l.sort_order}</span><strong>{l.title}</strong><small>{l.active?'Published':'Hidden'} · YouTube video</small></div><div><button className="smallAction" onClick={()=>editClub(l)}>Edit</button><button className="smallAction" onClick={()=>void toggleClub(l)}>{l.active?'Hide':'Publish'}</button></div></div>)}</div>}</section></div>}
 {tab==='members'&&<div className="adminGrid"><section className="panel"><h2>Members</h2><div className="responsiveTable"><table><thead><tr><th>Name</th><th>Username</th><th>Registered</th><th>Wallet</th></tr></thead><tbody>{members.map(m=><tr key={m.id}><td>{m.full_name}</td><td>@{m.username}</td><td>{fmt(m.created_at)}</td>
 <td>{money(wallets.find(w=>w.user_id===m.id)?.available_cents)}</td></tr>)}</tbody></table></div></section>
 <section className="panel"><h2>Recent brand feedback</h2><div className="responsiveTable"><table><thead><tr><th>Member</th><th>Brief</th><th>Rating</th><th>Reward</th></tr></thead>
 <tbody>{reviews.slice(0,75).map(r=><tr key={r.id}><td>{memberName(r.user_id)}</td><td>{tasks.find(t=>t.id===r.video_id)?.title||'Archived video'}</td>
 <td>{r.positive?<span className="ratingPos"><ThumbsUp size={14}/> Positive</span>:<span className="ratingNeg"><ThumbsDown size={14}/> Negative</span>}</td><td>{money(r.reward_cents)}</td></tr>)}</tbody></table></div></section></div>}
 {tab==='payments'&&<><div className="noticeBanner"><ShieldCheck/><div><strong>Payments are processed manually.</strong><span>Do not mark a transfer paid until money has been sent using the external provider. Record the authentic reference and staff note.</span></div></div>
 <div className="adminGrid"><section className="panel"><h2>Identity verification</h2>{!identity.length?<p className="muted">No ID submissions.</p>:identity.map(x=><div className="reviewRow" key={x.id}><div><strong>{memberName(x.user_id)}</strong><small>{fmt(x.created_at)} · <b>{x.status}</b></small></div>
 <div className="rowActions"><button onClick={()=>void openDoc(x)} className="smallAction"><FileText size={15}/> View file</button>
 {x.status==='pending'&&<><button onClick={()=>void approveDoc(x,true)} className="smallAction">Approve</button><button onClick={()=>void approveDoc(x,false)} className="smallAction danger">Reject</button></>}</div></div>)}
 {documentUrl&&<p className="documentLink"><a href={documentUrl} target="_blank" rel="noopener noreferrer">Open secure document (90-sec link) <ArrowRight size={14}/></a></p>}</section>
 <section className="panel"><h2>Payment destination checks</h2>{destinations.map(d=><div className="reviewRow" key={d.id}><div><strong>{memberName(d.user_id)}</strong><small>{d.method.toUpperCase()} · {d.account_details}</small></div>
 {d.verified?<span className="statusPill open">Approved</span>:<button className="smallAction" onClick={()=>void verifyDestination(d.id)}>Approve</button>}</div>)}
 {!destinations.length&&<p className="muted">No destinations supplied.</p>}</section></div>
 <section className="panel"><h2>Withdrawal requests</h2><div className="responsiveTable"><table><thead><tr><th>Member</th><th>Requested</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{payments.map(x=><tr key={x.id}><td>{memberName(x.user_id)}</td><td>{fmt(x.requested_at)}</td><td>{money(x.amount_cents)}</td>
 <td><span className="statusPill">{x.status}</span></td><td><div className="rowActions">
 {x.status==='requested'&&<button className="smallAction" onClick={()=>void process(x,'approve')}>Approve</button>}
 {x.status==='approved'&&<button className="smallAction" onClick={()=>void process(x,'processing')}>Start processing</button>}
 {x.status==='processing'&&<button className="smallAction" onClick={()=>void process(x,'paid')}>Mark paid</button>}
 {['requested','approved','processing'].includes(x.status)&&<button className="smallAction danger" onClick={()=>void process(x,'decline')}>Decline</button>}
 </div></td></tr>)}</tbody></table></div>{!payments.length&&<p className="muted">No payout requests yet.</p>}</section></>}
 {tab==='invitations'&&<section className="panel invitePanel"><span className="eyebrow"><BadgeCheck size={16}/> PRIVATE MEMBER INVITATIONS</span><h2>Issue a one-time invitation</h2><p>Each invitation works once, expires after seven days and permits username/password registration without an email verification step. Only MFA-verified administrators can create links.</p>
 <button className="button btnRed" disabled={busy} onClick={()=>void issueInvite()}><Plus size={18}/> Generate invitation</button>
 {invite&&<div className="inviteResult"><label>Share this private link<input readOnly value={invite}/></label><button className="button btnDark" onClick={()=>void navigator.clipboard.writeText(invite)}><ClipboardCopy size={16}/> Copy link</button></div>}
 <p className="finePrint">Only send invitations to eligible participants. The token is displayed once; it is stored in the database as a SHA-256 digest.</p></section>}
 {error&&<div className="error" role="alert"><X size={16}/> {error}</div>}{message&&<div className="success" role="status"><CheckCircle2 size={16}/> {message}</div>}
 </>;
}
