import {useCallback,useEffect,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Clock3,LockKeyhole,Play,ShieldCheck,ThumbsDown,ThumbsUp,Video} from 'lucide-react';
import {useMemberData} from './Member';
import {supabase,money,describeError,youtubeId,type Task,type Feedback} from '../lib';

function ReviewPlayer({task,reviewed,cycle,onDone,watched}:{task:Task;reviewed?:Feedback;cycle:number;watched:number;onDone:()=>Promise<void>}){
 const player=useRef<HTMLVideoElement|null>(null);
 const [started,setStarted]=useState<string|null>(null);
 const [clock,setClock]=useState(Date.now());
 const [seconds,setSeconds]=useState(watched);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const youtube=task.youtube_url?youtubeId(task.youtube_url):null;
 const youtubeResearch=Boolean(youtube && !task.licensed_video_url);
 const ping=useCallback(async(playing:boolean)=>{
  const video=player.current;if(!video||reviewed||youtubeResearch)return;
  try{
   const {data,error}=await supabase.rpc('track_video_playback',{p_video:task.id,p_position:video.currentTime,p_playing:playing});
   if(error)throw error;setSeconds(Number(data||0));
  }catch(e){setError(describeError(e))}
 },[task.id,reviewed,youtubeResearch]);
 useEffect(()=>{
  if(!youtubeResearch||reviewed)return;
  let active=true;
  void supabase.rpc('begin_video_research',{p_video:task.id}).then(({data,error})=>{
   if(!active)return;
   if(error)setError(error.message);else setStarted(String(data));
  });
  return()=>{active=false};
 },[task.id,reviewed,youtubeResearch,cycle]);
 useEffect(()=>{const t=window.setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(t)},[]);
 useEffect(()=>{
  if(youtubeResearch||reviewed)return;
  const id=window.setInterval(()=>{const el=player.current;if(el&&!el.paused&&!el.ended&&!document.hidden)void ping(true)},3000);
  const onVisibility=()=>{if(document.hidden){player.current?.pause();void ping(false)}};
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{window.clearInterval(id);document.removeEventListener('visibilitychange',onVisibility)};
 },[ping,reviewed,youtubeResearch]);
 const elapsed=youtubeResearch?(started?Math.max(0,(clock-new Date(started).getTime())/1000):0):seconds;
 const progress=Math.min(100,elapsed/task.min_watch_seconds*100);
 const ready=progress>=100;
 async function submit(positive:boolean){
  if(!ready||busy||reviewed)return;
  setBusy(true);setError('');
  try{
   const result=await supabase.rpc('submit_video_feedback',{p_video:task.id,p_positive:positive});
   if(result.error)throw result.error;
   await onDone();
  }catch(e){setError(describeError(e))}finally{setBusy(false)}
 }
 return <section className="researchMain panel">
  <div className="researchMainTitle"><div><span className="eyebrow">VIDEO {String(task.slot).padStart(2,'0')} · {task.brand_name}</span><h2>{task.title}</h2></div><span className="rewardChip">+{money(task.reward_cents)}</span></div>
  <div className="researchPlayerFrame">
   {youtube?<iframe key={task.id} src={`https://www.youtube-nocookie.com/embed/${youtube}?playsinline=1&rel=0`} title={task.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>:
    task.licensed_video_url?<video key={task.id} ref={player} controls playsInline preload="metadata" src={task.licensed_video_url} onPlay={()=>void ping(true)} onPause={()=>void ping(false)} onEnded={()=>void ping(false)}/>:
    <div className="emptyState">This video needs a valid source. Please contact the administrator.</div>}
  </div>
  <div className="researchPreparation">
   <div className="progressMeta"><span><Clock3 size={16}/> {youtubeResearch?'Independent research preparation':'Authorised media playback'}</span><strong>{Math.min(task.min_watch_seconds,Math.floor(elapsed))} / {task.min_watch_seconds} sec</strong></div>
   <div className="progressTrack"><div style={{width:progress+'%'}}/></div>
   <p>{reviewed?'Your evaluation is complete.':ready?'You can now submit your own evaluation.':'Read the brief and prepare your independent assessment while the timer completes.'}</p>
  </div>
  <div className="researchOpinion"><div><strong>Your opinion matters.</strong><span>Submit one independent positive or negative assessment of this brand creative.</span></div>
  {reviewed?<span className="reviewRecorded"><CheckCircle2 size={18}/> Evaluation recorded · {money(reviewed.reward_cents)}</span>:
   <div className="ratingActions"><button disabled={!ready||busy||!started&&youtubeResearch} className="rateBtn negative" onClick={()=>void submit(false)}><ThumbsDown size={19}/> Negative</button>
   <button disabled={!ready||busy||!started&&youtubeResearch} className="rateBtn positive" onClick={()=>void submit(true)}><ThumbsUp size={19}/> Positive</button></div>}</div>
  {youtubeResearch&&<p className="researchDisclosure"><ShieldCheck size={15}/> The embedded YouTube reference is optional and its playback is not tracked or compensated. Your research response is the payable service; the preparation timer is independent of the player.</p>}
  {error&&<p className="error" role="alert">{error}</p>}
 </section>
}
export function ResearchDay(){
 const {day}=useParams();const target=Number(day);
 const {data,loading,error,refresh}=useMemberData();
 const [picked,setPicked]=useState<string|null>(null);
 if(loading)return <div className="loading">Loading your research tasks…</div>;
 if(error||!data)return <div className="error">{error||'Unable to load daily research.'}</div>;
 const tasks=data.tasks.filter(t=>t.day_number===target).sort((a,b)=>a.slot-b.slot);
 const completed=new Set(data.feedback.filter(f=>f.cycle_number===data.day.cycle_number).map(f=>f.video_id));
 const pending=tasks.find(t=>!completed.has(t.id));
 const chosen=tasks.find(t=>t.id===picked&&(completed.has(t.id)||t.id===pending?.id))||pending||tasks.at(-1);
 const allowed=data.day.day_number===target&&Date.now()>=new Date(data.day.unlocks_at).getTime();
 const finished=data.completions.some(c=>c.day_number===target&&c.cycle_number===data.day.cycle_number);
 if(!allowed)return <div className="clubEmpty panel"><CheckCircle2 size={38}/><h2>{finished?'Research day completed':'Research day locked'}</h2><p>{finished?'Your feedback was recorded and the next day opens after the 24-hour countdown.':'Come back when your previous research day is complete and the countdown has finished.'}</p><Link className="button btnRed" to="/app">Back to daily tasks <ArrowRight size={17}/></Link></div>;
 if(!tasks.length)return <div className="clubEmpty panel"><Video size={38}/><h2>No videos assigned yet</h2><p>Your administrator can publish up to five videos for this day.</p><Link className="button btnRed" to="/app">Back to dashboard</Link></div>;
 return <div className="researchPage">
  <div className="pageHead"><div><Link to="/app" className="backLink"><ArrowLeft size={16}/> Daily tasks</Link><span className="eyebrow">CYCLE {String(data.day.cycle_number).padStart(2,'0')} · DAY {String(target).padStart(2,'0')}</span><h1>Today's video research<span className="redAccent">.</span></h1><p>One video at a time, in sequence. Complete your research assessment to unlock the next brief.</p></div></div>
  <div className="clubSummary"><span><CheckCircle2 size={16}/> {tasks.filter(t=>completed.has(t.id)).length} / {tasks.length} evaluations completed</span><span><ShieldCheck size={16}/> Private brand research</span></div>
  <div className="researchLayout">
   {chosen&&<ReviewPlayer key={chosen.id} task={chosen} reviewed={data.feedback.find(f=>f.video_id===chosen.id&&f.cycle_number===data.day.cycle_number)} cycle={data.day.cycle_number} watched={Number(data.watches.find(w=>w.video_id===chosen.id&&w.cycle_number===data.day.cycle_number)?.played_seconds||0)} onDone={async()=>{setPicked(null);await refresh()}}/>}
   <aside className="researchPlaylist panel"><div className="playlistHeader"><span className="eyebrow">YOUR PLAYLIST</span><h2>Today's research</h2><p>{tasks.length} assigned {tasks.length===1?'video':'videos'} · Complete in order</p></div><div className="playlistItems">
   {tasks.map((t,i)=>{
    const done=completed.has(t.id),unlocked=done||pending?.id===t.id,selected=t.id===chosen?.id;
    const youtube=t.youtube_url?youtubeId(t.youtube_url):null;
    return <button type="button" key={t.id} disabled={!unlocked} className={'playlistItem '+(selected?'chosen ':'')+(done?'complete ':'')} onClick={()=>setPicked(t.id)}>
     <div className="playlistThumb">{youtube?<img src={`https://i.ytimg.com/vi/${youtube}/mqdefault.jpg`} alt=""/>:<Video size={25}/>}<span className="playlistOrder">{String(i+1).padStart(2,'0')}</span></div>
     <div className="playlistText"><small>RESEARCH {String(i+1).padStart(2,'0')}</small><strong>{t.title}</strong><span>{done?'Completed':unlocked?'Available now':'Locked · Finish previous video'}</span></div>
     {done?<CheckCircle2 size={19} className="playlistDone"/>:unlocked?<Play size={17}/>:<LockKeyhole size={17}/>}
    </button>})}</div>
    <div className="playlistFoot"><Check size={16}/> One evaluation per video · Up to 5 daily</div></aside>
  </div>
 </div>;
}
