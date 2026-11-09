import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {ArrowDown,ArrowRight,BookOpen,CheckCircle2,ChevronRight,Edit3,Eye,EyeOff,FolderPlus,ImagePlus,Layers3,Plus,Save,ShieldCheck,Video,X} from 'lucide-react';
import {supabase,describeError,youtubeId} from '../lib';
import type {ClubCourse,ClubModule,ClubLesson} from './Club';

type CourseForm={title:string;description:string;active:boolean};
type LessonForm={title:string;description:string;youtube_url:string;active:boolean};
const emptyCourse:CourseForm={title:'',description:'',active:true};
const emptyLesson:LessonForm={title:'',description:'',youtube_url:'',active:true};

async function cropPortraitPhoto(file:File):Promise<Blob>{
 if(!file.type.startsWith('image/'))throw Error('Choose a JPEG, PNG or WebP image.');
 if(file.size>15000000)throw Error('Please choose an image smaller than 15 MB.');
 const image=await createImageBitmap(file);
 try{
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Unable to process your image.');
  const target=9/16;const ratio=image.width/image.height;
  let sx=0,sy=0,sw=image.width,sh=image.height;
  if(ratio>target){sw=image.height*target;sx=(image.width-sw)/2}
  else{sh=image.width/target;sy=(image.height-sh)/2}
  ctx.drawImage(image,sx,sy,sw,sh,0,0,720,1280);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Unable to create cover image.')),'image/webp',0.86));
 }finally{image.close()}
}

export function AcademyAdmin(){
 const [courses,setCourses]=useState<ClubCourse[]>([]),[modules,setModules]=useState<ClubModule[]>([]),[lessons,setLessons]=useState<ClubLesson[]>([]);
 const [selectedCourseId,setSelectedCourseId]=useState<string|null>(null),[selectedModuleId,setSelectedModuleId]=useState<string|null>(null);
 const [courseFormOpen,setCourseFormOpen]=useState(false),[editingCourse,setEditingCourse]=useState<ClubCourse|null>(null);
 const [courseForm,setCourseForm]=useState<CourseForm>(emptyCourse),[coverFile,setCoverFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 const [moduleTitle,setModuleTitle]=useState(''),[moduleDescription,setModuleDescription]=useState('');
 const [editingLesson,setEditingLesson]=useState<ClubLesson|null>(null),[lessonForm,setLessonForm]=useState<LessonForm>(emptyLesson);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const [c,m,l]=await Promise.all([
   supabase.from('club_courses').select('*').order('sort_order').order('created_at'),
   supabase.from('club_modules').select('*').order('sort_order').order('created_at'),
   supabase.from('club_lessons').select('*').order('sort_order').order('created_at')
  ]);
  for(const x of [c,m,l])if(x.error)throw x.error;
  const loaded=(c.data||[]) as ClubCourse[];
  setCourses(loaded);setModules((m.data||[]) as ClubModule[]);setLessons((l.data||[]) as ClubLesson[]);
  setSelectedCourseId(prev=>prev||loaded[0]?.id||null);
  setLoading(false);
 },[]);
 useEffect(()=>{void load().catch(e=>{setLoading(false);setError(describeError(e))})},[load]);
 useEffect(()=>{
  if(!coverFile){setPreview('');return}
  const src=URL.createObjectURL(coverFile);setPreview(src);return()=>URL.revokeObjectURL(src);
 },[coverFile]);
 const course=courses.find(c=>c.id===selectedCourseId)||null;
 const courseModules=modules.filter(m=>m.course_id===course?.id).sort((a,b)=>a.sort_order-b.sort_order);
 const module=courseModules.find(m=>m.id===selectedModuleId)||courseModules[0]||null;
 const moduleLessons=lessons.filter(l=>l.module_id===module?.id).sort((a,b)=>a.sort_order-b.sort_order);
 const countLessons=(moduleId:string)=>lessons.filter(l=>l.module_id===moduleId).length;
 const toast=(message:string)=>{setNotice(message);setError('')};
 const clearCourseEditor=()=>{setCourseFormOpen(false);setEditingCourse(null);setCourseForm(emptyCourse);setCoverFile(null)};
 const newCourse=()=>{setEditingCourse(null);setCourseForm(emptyCourse);setCoverFile(null);setCourseFormOpen(true);setError('');setNotice('')};
 const editCourse=(c:ClubCourse)=>{setSelectedCourseId(c.id);setCourseForm({title:c.title,description:c.description,active:c.active});setEditingCourse(c);setCoverFile(null);setCourseFormOpen(true);setError('')};
 async function saveCourse(e:FormEvent){
  e.preventDefault();setError('');setNotice('');setBusy(true);
  let uploadedPath:string|null=null;
  try{
   if(courseForm.title.trim().length<3)throw Error('Enter a course name of at least 3 characters.');
   if(!editingCourse&&!coverFile)throw Error('Select a course cover photo (automatically cropped to 9:16).');
   let url=editingCourse?.cover_url||null,storagePath=editingCourse?.cover_path||null;
   if(coverFile){
    const asset=await cropPortraitPhoto(coverFile);
    uploadedPath='courses/'+crypto.randomUUID()+'.webp';
    const upload=await supabase.storage.from('club-covers').upload(uploadedPath,asset,{contentType:'image/webp',cacheControl:'3600'});
    if(upload.error)throw upload.error;
    const publicUrl=supabase.storage.from('club-covers').getPublicUrl(uploadedPath);
    url=publicUrl.data.publicUrl;storagePath=uploadedPath;
   }
   const payload={title:courseForm.title.trim(),description:courseForm.description.trim(),cover_url:url,cover_path:storagePath,active:courseForm.active};
   const result=editingCourse?
    await supabase.from('club_courses').update(payload).eq('id',editingCourse.id).select('id').single():
    await supabase.from('club_courses').insert({...payload,sort_order:Math.max(0,...courses.map(c=>c.sort_order))+1}).select('id').single();
   if(result.error)throw result.error;
   await load();setSelectedCourseId(result.data.id as string);setSelectedModuleId(null);clearCourseEditor();
   toast(editingCourse?'Course updated.':'Course created — add your first module below.');
  }catch(e){
   if(uploadedPath)await supabase.storage.from('club-covers').remove([uploadedPath]);
   setError(describeError(e));
  }finally{setBusy(false)}
 }
 async function toggleCourse(c:ClubCourse){
  setError('');const {error}=await supabase.from('club_courses').update({active:!c.active}).eq('id',c.id);
  if(error)setError(error.message);else{await load();toast(c.active?'Course unpublished.':'Course published.')}
 }
 async function addModule(e:FormEvent){
  e.preventDefault();if(!course)return;
  setBusy(true);setError('');
  try{
   const {data,error}=await supabase.from('club_modules').insert({
    course_id:course.id,title:moduleTitle.trim(),description:moduleDescription.trim(),
    sort_order:Math.max(0,...courseModules.map(m=>m.sort_order))+1,active:true
   }).select('id').single();
   if(error)throw error;setModuleTitle('');setModuleDescription('');
   await load();setSelectedModuleId(data.id as string);toast('Module created. Now add its videos.');
  }catch(e){setError(describeError(e))}finally{setBusy(false)}
 }
 async function renameModule(m:ClubModule){
  const title=window.prompt('Module title',m.title)?.trim();
  if(!title||title===m.title)return;
  setBusy(true);setError('');
  try{
   const {error}=await supabase.from('club_modules').update({title}).eq('id',m.id);
   if(error)throw error;
   await supabase.from('club_lessons').update({module_title:title}).eq('module_id',m.id);
   await load();toast('Module renamed.');
  }catch(e){setError(describeError(e))}finally{setBusy(false)}
 }
 async function toggleModule(m:ClubModule){
  setError('');const {error}=await supabase.from('club_modules').update({active:!m.active}).eq('id',m.id);
  if(error)setError(error.message);else{await load();toast(m.active?'Module hidden.':'Module published.')}
 }
 function editVideo(l:ClubLesson){
  setSelectedModuleId(l.module_id);setEditingLesson(l);
  setLessonForm({title:l.title,description:l.description,youtube_url:l.youtube_url||'',active:l.active});
  setError('');setNotice('');
 }
 async function saveVideo(e:FormEvent){
  e.preventDefault();if(!module)return;
  setBusy(true);setError('');
  try{
   if(!youtubeId(lessonForm.youtube_url)&&!(editingLesson&&!lessonForm.youtube_url))throw Error('Enter a valid YouTube video URL.');
   const payload={module_id:module.id,module_title:module.title,title:lessonForm.title.trim(),
     description:lessonForm.description.trim(),youtube_url:lessonForm.youtube_url.trim()||null,active:lessonForm.active};
   const result=editingLesson?
    await supabase.from('club_lessons').update(payload).eq('id',editingLesson.id):
    await supabase.from('club_lessons').insert({...payload,sort_order:Math.max(0,...moduleLessons.map(l=>l.sort_order))+1});
   if(result.error)throw result.error;
   setEditingLesson(null);setLessonForm(emptyLesson);await load();toast(editingLesson?'Lesson updated.':'YouTube lesson added.');
  }catch(e){setError(describeError(e))}finally{setBusy(false)}
 }
 async function toggleVideo(l:ClubLesson){
  setError('');const {error}=await supabase.from('club_lessons').update({active:!l.active}).eq('id',l.id);
  if(error)setError(error.message);else{await load();toast(l.active?'Lesson hidden.':'Lesson published.')}
 }
 async function moveVideo(l:ClubLesson,direction:-1|1){
  const index=moduleLessons.findIndex(item=>item.id===l.id),other=moduleLessons[index+direction];
  if(!other)return;
  setBusy(true);setError('');
  try{
   const first=await supabase.from('club_lessons').update({sort_order:other.sort_order}).eq('id',l.id);
   if(first.error)throw first.error;
   const second=await supabase.from('club_lessons').update({sort_order:l.sort_order}).eq('id',other.id);
   if(second.error)throw second.error;
   await load();toast('Lesson order updated.');
  }catch(e){setError(describeError(e))}finally{setBusy(false)}
 }
 if(loading)return <div className="loading">Loading Member Club administration…</div>;
 return <section className="academyAdmin">
  <div className="academyAdminHeadline"><div><span className="eyebrow"><GraduationAdminIcon/> COURSES · MODULES · VIDEOS</span><h2>Member Club management</h2><p className="muted">Create a 9:16 course cover, add as many modules as you need, then add YouTube videos inside each module.</p></div>
   <button className="button btnRed" type="button" onClick={newCourse}><Plus size={16}/> New course</button></div>
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="successText" role="status"><CheckCircle2 size={16}/>{notice}</p>}
  <div className="academyAdminGrid">
   <aside className="panel academyAdminSidebar"><div className="academyAdminStep"><span>01</span><div><strong>Your courses</strong><small>Select a course to manage</small></div></div>
    <div className="academyAdminCourseList">{courses.map(c=><button type="button" className={'academyAdminCourseChoice '+(course?.id===c.id?'selected':'')} onClick={()=>{setSelectedCourseId(c.id);setSelectedModuleId(null);clearCourseEditor();setEditingLesson(null)}} key={c.id}>
     <div className="academyMiniCover">{c.cover_url?<img src={c.cover_url} alt=""/>:<BookOpen size={21}/>}</div><span><strong>{c.title}</strong><small>{modules.filter(m=>m.course_id===c.id).length} modules · {c.active?'Published':'Hidden'}</small></span><ChevronRight size={16}/>
    </button>)}</div>
    <button className="button btnOutline wide" type="button" onClick={newCourse}><FolderPlus size={16}/> Add course</button>
   </aside>
   <div className="academyAdminEditor">
    {courseFormOpen?<section className="panel"><div className="academyAdminStep"><span>01</span><div><strong>{editingCourse?'Edit course':'Create your course'}</strong><small>Name, description and portrait cover</small></div></div>
      <form className="stackedForm" onSubmit={e=>void saveCourse(e)}>
       <label>Course name<input required minLength={3} maxLength={120} value={courseForm.title} onChange={e=>setCourseForm(f=>({...f,title:e.target.value}))} placeholder="e.g. YVRewards Masterclass"/></label>
       <label>Short description<textarea rows={3} maxLength={2000} value={courseForm.description} onChange={e=>setCourseForm(f=>({...f,description:e.target.value}))} placeholder="What will members learn?"/></label>
       <label>Cover photo · 9:16 portrait<input type="file" accept="image/jpeg,image/png,image/webp" required={!editingCourse} onChange={e=>setCoverFile(e.target.files?.[0]||null)}/></label>
       <small className="muted">Upload a photo. It will be automatically centred and cropped to a sharp 720 × 1280 (9:16) WebP cover.</small>
       {(preview||editingCourse?.cover_url)&&<div className="academyUploadPreview"><img src={preview||editingCourse?.cover_url||''} alt="Course cover preview"/></div>}
       <label className="checkLabel"><input type="checkbox" checked={courseForm.active} onChange={e=>setCourseForm(f=>({...f,active:e.target.checked}))}/> Publish this course for members</label>
       <div className="academyFormActions"><button className="button btnRed" disabled={busy} type="submit"><Save size={16}/> {busy?'Saving…':'Save course'}</button>
        <button className="button btnOutline" type="button" onClick={clearCourseEditor}>Cancel</button></div>
      </form></section>:
     course?<><section className="panel academyAdminActiveCourse">
      <div className="academyAdminStep"><span>01</span><div><strong>Course selected</strong><small>Manage its photo and publishing</small></div></div>
      <div className="academyCourseSummary"><div className="academyMiniCover large">{course.cover_url?<img src={course.cover_url} alt={course.title+' cover'}/>:<BookOpen size={30}/>}</div>
       <div><h2>{course.title}</h2><p className="muted">{course.description||'No description added yet.'}</p><small>{courseModules.length} modules · {course.active?'Published':'Hidden'}</small>
        <div className="rowActions"><button type="button" className="smallAction" onClick={()=>editCourse(course)}><Edit3 size={14}/> Edit course</button>
         <button type="button" className="smallAction" onClick={()=>void toggleCourse(course)}>{course.active?<EyeOff size={14}/>:<Eye size={14}/>} {course.active?'Unpublish':'Publish'}</button></div>
       </div></div></section>
      <section className="panel"><div className="academyAdminStep"><span>02</span><div><strong>Modules</strong><small>Unlimited sections within this course</small></div></div>
       <div className="academyAdminModules">{courseModules.map(m=><div className={'academyAdminModuleChoice '+(module?.id===m.id?'selected':'')} key={m.id}>
        <button type="button" className="academyAdminModuleSelect" onClick={()=>{setSelectedModuleId(m.id);setEditingLesson(null);setLessonForm(emptyLesson)}}>
         <Layers3 size={18}/><span><strong>{m.title}</strong><small>{countLessons(m.id)} lessons · {m.active?'Published':'Hidden'}</small></span><ChevronRight size={16}/></button>
        <button type="button" className="smallAction" title="Rename module" onClick={()=>void renameModule(m)} disabled={busy}><Edit3 size={14}/></button>
        <button type="button" className="smallAction" title={m.active?'Hide module':'Publish module'} onClick={()=>void toggleModule(m)} disabled={busy}>{m.active?<EyeOff size={14}/>:<Eye size={14}/>}</button>
       </div>)}</div>
       <form className="stackedForm academyQuickForm" onSubmit={e=>void addModule(e)}><label>New module name<input required minLength={2} maxLength={120} value={moduleTitle} onChange={e=>setModuleTitle(e.target.value)} placeholder="e.g. Introduction to video research"/></label>
        <label>Module description (optional)<input maxLength={1500} value={moduleDescription} onChange={e=>setModuleDescription(e.target.value)} placeholder="Short learning objective"/></label>
        <button type="submit" disabled={busy} className="button btnOutline"><Plus size={16}/> Add module</button></form>
      </section>
      {module&&<section className="panel"><div className="academyAdminStep"><span>03</span><div><strong>Videos · {module.title}</strong><small>Add unlimited YouTube lessons, one at a time</small></div></div>
       {moduleLessons.length>0&&<div className="academyAdminLessonList">{moduleLessons.map((lesson,i)=><div key={lesson.id} className="academyAdminLessonItem">
        <div className="academyVideoThumbnail">{lesson.youtube_url&&youtubeId(lesson.youtube_url)?<img src={'https://i.ytimg.com/vi/'+youtubeId(lesson.youtube_url)+'/mqdefault.jpg'} alt=""/>:<BookOpen size={20}/>}</div>
        <div><strong>{i+1}. {lesson.title}</strong><small>{lesson.active?'Published':'Hidden'} · {lesson.youtube_url?'YouTube video':'Reading guide'}</small></div>
        <div className="academyLessonActions">
         <button type="button" className="smallAction" onClick={()=>void moveVideo(lesson,-1)} disabled={busy||i===0} title="Move up">↑</button>
         <button type="button" className="smallAction" onClick={()=>void moveVideo(lesson,1)} disabled={busy||i===moduleLessons.length-1} title="Move down"><ArrowDown size={14}/></button>
         <button type="button" className="smallAction" onClick={()=>editVideo(lesson)} title="Edit"><Edit3 size={14}/></button>
         <button type="button" className="smallAction" onClick={()=>void toggleVideo(lesson)} title={lesson.active?'Hide':'Publish'}>{lesson.active?<EyeOff size={14}/>:<Eye size={14}/>}</button>
        </div></div>)}</div>}
       <form className="stackedForm academyQuickForm" onSubmit={e=>void saveVideo(e)}><h3>{editingLesson?'Edit a lesson':'Add a YouTube video'}</h3>
        <label>Video title<input required minLength={3} maxLength={140} value={lessonForm.title} onChange={e=>setLessonForm(f=>({...f,title:e.target.value}))} placeholder="e.g. How to complete your first task"/></label>
        <label>YouTube video URL<input required={!editingLesson} type="url" value={lessonForm.youtube_url} onChange={e=>setLessonForm(f=>({...f,youtube_url:e.target.value}))} placeholder="https://www.youtube.com/watch?v=..."/></label>
        {youtubeId(lessonForm.youtube_url)&&<div className="adminVideoPreview"><img src={'https://i.ytimg.com/vi/'+youtubeId(lessonForm.youtube_url)+'/hqdefault.jpg'} alt="YouTube video preview"/><span>Video detected — it will be embedded automatically.</span></div>}
        <label>Lesson description (optional)<textarea rows={3} maxLength={1500} value={lessonForm.description} onChange={e=>setLessonForm(f=>({...f,description:e.target.value}))} placeholder="What is covered in this video?"/></label>
        <label className="checkLabel"><input type="checkbox" checked={lessonForm.active} onChange={e=>setLessonForm(f=>({...f,active:e.target.checked}))}/> Visible to members</label>
        <div className="academyFormActions"><button type="submit" className="button btnRed" disabled={busy}><Video size={16}/> {editingLesson?'Save lesson':'Add video'}</button>
         {editingLesson&&<button type="button" className="button btnOutline" onClick={()=>{setEditingLesson(null);setLessonForm(emptyLesson)}}><X size={15}/> Cancel</button>}</div>
       </form>
      </section>}
     </>:
     <section className="clubEmpty panel"><ImagePlus size={36}/><h2>Create your first course</h2><p>Start with a name and a portrait photo. Then you can add modules and videos, all from this screen.</p>
      <button type="button" className="button btnRed" onClick={newCourse}><Plus size={16}/> Create course <ArrowRight size={16}/></button></section>}
   </div>
  </div>
  <p className="academyAdminNote"><ShieldCheck size={16}/> Courses, modules and videos can be unpublished without deleting members' previous learning progress.</p>
 </section>;
}
function GraduationAdminIcon(){return <BookOpen size={15}/>;}
