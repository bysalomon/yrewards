import {useCallback,useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,CirclePlay,GraduationCap,Layers3,Play,ShieldCheck,Sparkles} from 'lucide-react';
import {supabase,describeError,youtubeId} from '../lib';
import {useAuth} from '../AuthContext';

export type ClubCourse={id:string;title:string;description:string;cover_url:string|null;cover_path:string|null;sort_order:number;active:boolean;created_at:string};
export type ClubModule={id:string;course_id:string;title:string;description:string;sort_order:number;active:boolean;created_at:string};
export type ClubLesson={id:string;module_id:string;module_title:string;title:string;description:string;youtube_url:string|null;sort_order:number;active:boolean};
type ClubProgress={lesson_id:string};
type AcademyData={courses:ClubCourse[];modules:ClubModule[];lessons:ClubLesson[];done:Set<string>};

function useAcademy(){
 const {user}=useAuth();
 const [data,setData]=useState<AcademyData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  if(!user)return;
  try{
   setError('');
   const [c,m,l,p]=await Promise.all([
    supabase.from('club_courses').select('*').eq('active',true).order('sort_order').order('created_at'),
    supabase.from('club_modules').select('*').eq('active',true).order('sort_order'),
    supabase.from('club_lessons').select('*').eq('active',true).order('sort_order'),
    supabase.from('club_progress').select('lesson_id').eq('user_id',user.id)
   ]);
   for(const x of [c,m,l,p])if(x.error)throw x.error;
   setData({courses:(c.data||[]) as ClubCourse[],modules:(m.data||[]) as ClubModule[],
    lessons:(l.data||[]) as ClubLesson[],done:new Set(((p.data||[]) as ClubProgress[]).map(x=>x.lesson_id))});
  }catch(e){setError(describeError(e))}finally{setLoading(false)}
 },[user?.id]);
 useEffect(()=>{void refresh()},[refresh]);
 return {data,loading,error,refresh};
}

function courseLessons(data:AcademyData,courseId:string){
 const modules=new Set(data.modules.filter(m=>m.course_id===courseId).map(m=>m.id));
 return data.lessons.filter(l=>modules.has(l.module_id));
}
function progress(data:AcademyData,courseId:string){
 const lessons=courseLessons(data,courseId);
 const completed=lessons.filter(l=>data.done.has(l.id)).length;
 return {completed,total:lessons.length,percent:lessons.length?Math.round(completed/lessons.length*100):0};
}
function Cover({course,className='' }:{course:ClubCourse;className?:string}){
 return <div className={'academyCover '+className}>
  {course.cover_url?<img src={course.cover_url} alt={course.title+' course cover'} loading="lazy"/>:
   <div className="academyCoverPlaceholder"><GraduationCap size={45}/><span>YVREWARDS</span><strong>{course.title}</strong></div>}
  <div className="academyCoverTint"/>
 </div>;
}

export function MemberClub(){
 const {data,loading,error}=useAcademy();
 if(loading)return <div className="loading">Loading your Member Club…</div>;
 if(error||!data)return <div className="error">{error||'Unable to load courses.'}</div>;
 const {courses}=data;
 const featured=courses.find(c=>{const p=progress(data,c.id);return p.completed>0&&p.completed<p.total})||courses[0];
 const started=courses.filter(c=>progress(data,c.id).completed>0);
 return <div className="academyHome">
  <section className="academyHero">
   <div className="academyHeroText"><span className="eyebrow"><Sparkles size={15}/> YVREWARDS · MEMBER CLUB</span>
    <h1>Learn more.<br/><em>Unlock your potential.</em></h1>
    <p>Expert tutorials, practical guides and video courses — organised in your own private learning library.</p>
    <div className="academyHeroActions">
     {featured?<Link className="button btnRed" to={'/app/club/'+featured.id}><Play size={16}/> {progress(data,featured.id).completed?'Continue learning':'Start learning'}</Link>:
      <span className="button btnOutline">Courses coming soon</span>}
     <a className="button btnOutline" href="#academyCourses">Explore courses <ArrowRight size={16}/></a>
    </div>
    <div className="academyHeroTags"><span>Self-paced lessons</span><span>Private member access</span><span>No additional charge</span></div>
   </div>
   <div className="academyHeroVisual" aria-hidden="true">
    <div className="academyHeroGlow"/>
    {featured?<Cover course={featured} className="academyHeroCover"/>:<div className="academyHeroNoCover"><BookOpen size={82}/></div>}
    <div className="academyHeroFloat"><GraduationCap size={18}/> Your learning, your pace</div>
   </div>
  </section>
  {started.length>0&&<section className="academySection"><div className="academySectionTitle"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Continue learning</h2></div><span className="academyCount">{started.length} in progress</span></div>
   <div className="academyContinueRow">{started.map(course=>{const p=progress(data,course.id);return <Link className="academyContinueCard" to={'/app/club/'+course.id} key={course.id}>
    <Cover course={course}/><div><h3>{course.title}</h3><p>{p.completed} of {p.total} lessons completed</p><div className="academyProgressTrack"><span style={{width:p.percent+'%'}}/></div></div><ArrowRight size={19}/></Link>})}</div>
  </section>}
  <section id="academyCourses" className="academySection"><div className="academySectionTitle"><div><span className="eyebrow">YOUR COURSE LIBRARY</span><h2>Explore your courses <span className="redAccent">.</span></h2><p>Choose a course to see its modules, videos and learning progress.</p></div><span className="academyCount">{courses.length} {courses.length===1?'course':'courses'}</span></div>
   {!courses.length?<div className="clubEmpty panel"><BookOpen size={38}/><h2>Your course library is ready</h2><p>New courses will appear here as soon as they are published by your administrator.</p></div>:
   <div className="academyCourseRail">{courses.map(course=>{
    const p=progress(data,course.id);const count=data.modules.filter(m=>m.course_id===course.id).length;
    return <Link key={course.id} className="academyCourseCard" to={'/app/club/'+course.id}>
     <div className="academyCourseImage"><Cover course={course}/>
      <span className="academyCardStatus">{p.percent===100&&p.total>0?'COMPLETED':p.completed>0?'IN PROGRESS':'AVAILABLE'}</span>
      <span className="academyCardOverlayTitle">{course.title}</span></div>
     <div className="academyCourseInfo"><strong>{course.title}</strong><small>{count} {count===1?'module':'modules'} · {p.total} {p.total===1?'lesson':'lessons'}</small>
      <div className="academyProgressTrack"><span style={{width:p.percent+'%'}}/></div><span className="academyCardProgress">{p.percent}% completed <ArrowRight size={15}/></span></div>
    </Link>})}</div>}
  </section>
  <p className="academyDisclaimer"><ShieldCheck size={16}/> Member Club lessons are educational and do not provide monetary rewards.</p>
 </div>;
}

export function CourseView(){
 const {courseId}=useParams();
 const {user}=useAuth();
 const {data,loading,error,refresh}=useAcademy();
 const [picked,setPicked]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(loading)return <div className="loading">Loading your course…</div>;
 if(error||!data)return <div className="error">{error||'Unable to load course.'}</div>;
 const course=data.courses.find(c=>c.id===courseId);
 if(!course)return <div className="clubEmpty panel"><BookOpen size={36}/><h2>Course unavailable</h2><p>This course may be unpublished or no longer available.</p><Link className="button btnRed" to="/app/club">Back to Member Club</Link></div>;
 const modules=data.modules.filter(m=>m.course_id===course.id).sort((a,b)=>a.sort_order-b.sort_order);
 const lessons=courseLessons(data,course.id);
 const current=lessons.find(l=>l.id===picked)||lessons.find(l=>!data.done.has(l.id))||lessons[0];
 const p=progress(data,course.id);
 const completedLessons=data.done;
 async function markCompleted(){
  if(!user||!current||completedLessons.has(current.id)||busy)return;
  setBusy(true);setMessage('');
  const {error}=await supabase.from('club_progress').insert({user_id:user.id,lesson_id:current.id});
  if(error)setMessage(error.message);
  else{
   const next=lessons.find(l=>l.id!==current.id&&!completedLessons.has(l.id));
   setPicked(next?.id||current.id);await refresh();
  }
  setBusy(false);
 }
 return <div className="researchPage academyDetail">
  <Link to="/app/club" className="backLink"><ArrowLeft size={16}/> All courses</Link>
  <div className="academyDetailHead">
   <Cover course={course} className="academyDetailCover"/>
   <div><span className="eyebrow">MEMBER CLUB · YOUR COURSE</span><h1>{course.title}<span className="redAccent">.</span></h1>
    <p>{course.description}</p><div className="academyDetailBadges"><span><Layers3 size={15}/> {modules.length} modules</span><span><BookOpen size={15}/> {lessons.length} lessons</span><span><CheckCircle2 size={15}/> {p.percent}% complete</span></div>
    <div className="academyProgressTrack"><span style={{width:p.percent+'%'}}/></div></div>
  </div>
  <div className="clubSummary"><span><CheckCircle2 size={16}/> {p.completed} / {p.total} lessons completed</span><span><ShieldCheck size={16}/> Included in membership</span></div>
  {!lessons.length?<div className="clubEmpty panel"><BookOpen size={36}/><h2>Lessons are being prepared</h2><p>Your administrator can add unlimited modules and videos to this course.</p></div>:
  <div className="researchLayout">
   <section className="researchMain panel">
    <span className="eyebrow">NOW PLAYING · {modules.find(m=>m.id===current?.module_id)?.title||'MODULE'}</span>
    <h2>{current?.title}</h2>
    <div className="researchPlayerFrame">{current?.youtube_url?<iframe key={current.id} src={'https://www.youtube-nocookie.com/embed/'+(youtubeId(current.youtube_url)||'')+'?playsinline=1&rel=0'} title={current.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>:
      <div className="clubReadingLesson"><BookOpen size={42}/><span className="eyebrow">YVREWARDS ACADEMY</span><h3>{current?.title}</h3><p>{current?.description}</p></div>}</div>
    {current?.youtube_url&&<p className="clubLessonDescription">{current.description||'Watch this lesson at your own pace.'}</p>}
    <div className="clubLessonAction">{current&&data.done.has(current.id)?<span className="reviewRecorded"><CheckCircle2 size={18}/> Lesson completed</span>:
      <button type="button" className="button btnRed" disabled={busy} onClick={()=>void markCompleted()}><CheckCircle2 size={17}/> Mark as completed <ArrowRight size={16}/></button>}</div>
    <p className="researchDisclosure"><ShieldCheck size={15}/> Educational videos and reading guides are free of monetary rewards.</p>
    {message&&<p className="error">{message}</p>}
   </section>
   <aside className="researchPlaylist panel">
    <div className="playlistHeader"><span className="eyebrow">COURSE CONTENT</span><h2>Learning path</h2><p>{modules.length} modules · {lessons.length} lessons</p></div>
    {modules.map(module=>{
     const list=lessons.filter(l=>l.module_id===module.id);const completed=list.filter(l=>data.done.has(l.id)).length;
     return <div className="clubModule" key={module.id}>
      <h3><BookOpen size={17}/> {module.title} <small>{completed}/{list.length}</small></h3>
      {module.description&&<p className="academyModuleDesc">{module.description}</p>}
      <div className="playlistItems">{list.length===0?<p className="muted">No published lessons yet.</p>:
       list.map((l,index)=><button key={l.id} className={'playlistItem '+(l.id===current?.id?'chosen ':'')+(data.done.has(l.id)?'complete':'')} type="button" onClick={()=>setPicked(l.id)}>
        <div className="clubLessonIcon">{data.done.has(l.id)?<CheckCircle2 size={20}/>:l.id===current?.id?<CirclePlay size={20}/>:<Play size={17}/>}</div>
        <div className="playlistText"><small>LESSON {String(index+1).padStart(2,'0')}</small><strong>{l.title}</strong><span>{data.done.has(l.id)?'Completed':l.youtube_url?'Watch video':'Read lesson'}</span></div>
       </button>)}</div>
     </div>})}
   </aside>
  </div>}
 </div>;
}
