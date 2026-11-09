import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,BookOpen,CheckCircle2,CirclePlay,Play,ShieldCheck} from 'lucide-react';
import {supabase,describeError,youtubeId} from '../lib';
import {useAuth} from '../AuthContext';
type Lesson={id:string;module_title:string;title:string;description:string;youtube_url:string|null;sort_order:number;active:boolean};
type Completion={lesson_id:string};
export function MemberClub(){
 const {user,admin}=useAuth();
 const [lessons,setLessons]=useState<Lesson[]>([]);const [done,setDone]=useState<string[]>([]);
 const [picked,setPicked]=useState<string|null>(null);const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{
  if(!user)return;let cancelled=false;
  void Promise.all([supabase.from('club_lessons').select('*').eq('active',true).order('module_title').order('sort_order'),
    supabase.from('club_progress').select('lesson_id').eq('user_id',user.id)]).then(([a,b])=>{
    if(cancelled)return;if(a.error||b.error)setError(a.error?.message||b.error?.message||'Unable to load Member Club');
    else{setLessons((a.data||[]) as Lesson[]);setDone(((b.data||[]) as Completion[]).map(x=>x.lesson_id))}
    setLoading(false);
  });return()=>{cancelled=true};
 },[user]);
 const current=lessons.find(l=>l.id===picked)||lessons.find(l=>!done.includes(l.id))||lessons[0];
 const groups=useMemo(()=>Array.from(new Set(lessons.map(l=>l.module_title))),[lessons]);
 async function complete(){
  if(!user||!current||done.includes(current.id)||busy)return;
  setBusy(true);setError('');
  try{
   const {error}=await supabase.from('club_progress').insert({user_id:user.id,lesson_id:current.id});
   if(error)throw error;
   const next=lessons.find(l=>l.id!==current.id&&!done.includes(l.id));
   setDone(old=>[...old,current.id]);setPicked(next?.id||current.id);
  }catch(e){setError(describeError(e))}finally{setBusy(false)}
 }
 if(loading)return <div className="loading">Opening Member Club…</div>;
 return <div className="researchPage">
   <div className="pageHead"><div><span className="eyebrow"><BookOpen size={15}/> YVREWARDS MEMBER CLUB</span><h1>Member Club <span className="redAccent">.</span></h1><p>Your private learning space for research tutorials, platform guides and member resources.</p></div></div>
   <div className="clubSummary"><span><CheckCircle2 size={16}/> {done.length} / {lessons.length} lessons completed</span><span><ShieldCheck size={16}/> Included in membership</span></div>
   {error&&<p className="error">{error}</p>}
   {!lessons.length?<div className="clubEmpty panel"><BookOpen size={40}/><h2>Your Member Club is ready.</h2><p>No video lessons have been published yet. Lessons will appear here as soon as your administrator adds them.</p>{admin&&<Link to="/admin" className="button btnRed">Add first lesson <ArrowRight size={16}/></Link>}</div>:
    <div className="researchLayout">
      <section className="researchMain panel"><span className="eyebrow">NOW PLAYING · {current?.module_title}</span><h2>{current?.title}</h2><div className="researchPlayerFrame">{current?.youtube_url?<iframe key={current?.id} src={`https://www.youtube-nocookie.com/embed/${youtubeId(current.youtube_url)||''}?playsinline=1&rel=0`} title={current?.title||'Member Club video'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>:<div className="clubReadingLesson"><BookOpen size={43}/><span className="eyebrow">YVREWARDS LEARNING</span><h3>{current?.title}</h3><p>{current?.description}</p></div>}</div>{current?.youtube_url&&<p className="clubLessonDescription">{current?.description||'Watch this lesson at your own pace.'}</p>}<div className="clubLessonAction">{current&&done.includes(current.id)?<span className="reviewRecorded"><CheckCircle2 size={18}/> Lesson completed</span>:<button className="button btnRed" disabled={busy} onClick={()=>void complete()}><CheckCircle2 size={17}/> Mark as completed</button>}</div><p className="researchDisclosure"><ShieldCheck size={15}/> Learning lessons do not provide monetary rewards and watching is optional.</p></section>
      <aside className="researchPlaylist panel"><div className="playlistHeader"><span className="eyebrow">COURSE CONTENT</span><h2>Learning path</h2><p>{groups.length} {groups.length===1?'module':'modules'} · {lessons.length} lessons</p></div>
      {groups.map(group=><div key={group} className="clubModule"><h3><BookOpen size={16}/>{group}</h3><div className="playlistItems">{lessons.filter(l=>l.module_title===group).map((lesson,index)=><button type="button" key={lesson.id} className={'playlistItem '+(lesson.id===current?.id?'chosen ':'')+(done.includes(lesson.id)?'complete ':'')} onClick={()=>setPicked(lesson.id)}><div className="clubLessonIcon">{done.includes(lesson.id)?<CheckCircle2 size={19}/>:lesson.id===current?.id?<CirclePlay size={19}/>:<Play size={17}/>}</div><div className="playlistText"><small>LESSON {String(index+1).padStart(2,'0')}</small><strong>{lesson.title}</strong><span>{done.includes(lesson.id)?'Completed':'Watch lesson'}</span></div></button>)}</div></div>)}</aside>
    </div>}
 </div>;
}
