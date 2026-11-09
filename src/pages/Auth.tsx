import {useState,type FormEvent} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {ArrowRight,LockKeyhole,ShieldCheck} from 'lucide-react';
import {supabase,describeError,userEmail} from '../lib';
import {useAuth} from '../AuthContext';
import {Brand} from './Landing';
export function Login(){
 const [username,setUsername]=useState('');const [password,setPassword]=useState('');
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const {refresh}=useAuth();const navigate=useNavigate();
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');
  const {error:authError}=await supabase.auth.signInWithPassword({
   email:username.includes('@')?username.trim():userEmail(username),password});
  if(authError)setError('Username or password not recognised.');
  else{await refresh();navigate('/app');}setBusy(false);
 }
 return <div className="authScreen"><div className="authTop"><Link to="/"><Brand/></Link><Link to="/">Back to home</Link></div>
 <form className="authPanel" onSubmit={e=>void submit(e)}><span className="eyebrow">MEMBER ACCESS</span><h1>Welcome back.</h1><p>Sign in securely to continue your research tasks.</p>
 <label>Username (or administrator email)<input autoComplete="username" value={username} required onChange={e=>setUsername(e.target.value)} placeholder="Username or admin email"/></label>
 <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></label>
 {error&&<p className="error" role="alert">{error}</p>}<button className="button btnRed wide" disabled={busy}>{busy?'Signing in…':'Sign in'} <ArrowRight size={17}/></button>
 <p className="finePrint">Access is available to invited members only. No public registration.</p>
 <Link className="muted" to="/invite">How do invitations work?</Link></form></div>
}
export function Invitation(){
 const [params]=useSearchParams();const token=params.get('token')||'';
 const [form,setForm]=useState({username:'',first_name:'',last_name:'',password:'',confirm:''});
 const [consents,setConsents]=useState({terms:false,privacy:false,adult:false});
 const [error,setError]=useState('');const [success,setSuccess]=useState(false);const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();if(form.password!==form.confirm){setError('Passwords do not match.');return}
  setBusy(true);setError('');
  try{
   const {data,error:fnError}=await supabase.functions.invoke('accept-invite',{body:{token,username:form.username,first_name:form.first_name,
    last_name:form.last_name,password:form.password,consent_terms:consents.terms,consent_privacy:consents.privacy,is_adult:consents.adult}});
   if(fnError||data?.error)throw Error(data?.error||fnError?.message||'Registration failed');
   setSuccess(true);
  }catch(e){setError(describeError(e))}finally{setBusy(false)}
 }
 const put=(key:keyof typeof form)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm({...form,[key]:e.target.value});
 return <div className="authScreen"><div className="authTop"><Link to="/"><Brand/></Link><Link to="/">Back to home</Link></div>
 <div className="authPanel larger"><span className="eyebrow">EXCLUSIVE INVITATION</span><h1>{success?'You’re in.':'Create your account.'}</h1>
 {success?<><p>Your account is ready. Sign in with your username and password; there is no email verification step.</p>
 <Link to="/login" className="button btnRed wide">Continue to sign in <ArrowRight size={18}/></Link></>:
 <><p>Join our independent brand-research community using your personal invitation.</p>
 {!/^[0-9a-f]{64}$/.test(token)&&<p className="error">You need an active invitation link to register.</p>}
 <form onSubmit={e=>void submit(e)}><div className="fieldGrid"><label>First name<input required minLength={2} maxLength={60} value={form.first_name} onChange={put('first_name')}/></label>
 <label>Last name<input required minLength={2} maxLength={60} value={form.last_name} onChange={put('last_name')}/></label></div>
 <label>Username<input required pattern="[A-Za-z0-9_]{3,24}" value={form.username} onChange={put('username')} placeholder="Choose a unique username"/></label>
 <label>Password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={form.password} onChange={put('password')}/></label>
 <label>Confirm password<input type="password" autoComplete="new-password" required minLength={12} value={form.confirm} onChange={put('confirm')}/></label>
 <label className="checkLabel"><input type="checkbox" required checked={consents.terms} onChange={e=>setConsents({...consents,terms:e.target.checked})}/> I agree to the <Link to="/terms">Terms</Link>.</label>
 <label className="checkLabel"><input type="checkbox" required checked={consents.privacy} onChange={e=>setConsents({...consents,privacy:e.target.checked})}/> I have read the <Link to="/privacy">Privacy Policy</Link>.</label>
 <label className="checkLabel"><input type="checkbox" required checked={consents.adult} onChange={e=>setConsents({...consents,adult:e.target.checked})}/> I confirm I am at least 18 years old.</label>
 {error&&<p className="error" role="alert">{error}</p>}
 <button className="button btnRed wide" disabled={busy||!token}>{busy?'Creating account…':'Create my account'} <ArrowRight size={18}/></button></form>
 <p className="finePrint"><LockKeyhole size={14}/> No email confirmation is required. Store your password securely; account recovery requires manual assistance.</p></>}
 </div></div>;
}
export function AdminMfa(){
 const {admin}=useAuth();const navigate=useNavigate();
 const [factor,setFactor]=useState('');const [qr,setQr]=useState('');const [code,setCode]=useState('');
 const [error,setError]=useState('');const [message,setMessage]=useState('');
 async function enrol(){setError('');try{
  const {data:list}=await supabase.auth.mfa.listFactors();
  const verified=list?.totp.find(f=>f.status==='verified');
  if(verified){setFactor(verified.id);setMessage('Enter a code from your existing authenticator.');return}
  const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp'});
  if(error)throw error;setFactor(data.id);setQr(data.totp.qr_code);setMessage('Scan the QR code in your authenticator.');
 }catch(e){setError(describeError(e))}}
 async function verify(e:FormEvent){e.preventDefault();setError('');try{
  const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:factor,code});
  if(error)throw error;navigate('/admin', {replace:true});
 }catch(e){setError(describeError(e))}}
 if(!admin)return <p>Admin access required.</p>;
 return <div className="authScreen"><div className="authPanel"><span className="eyebrow"><ShieldCheck size={15}/> ADMIN SECURITY</span>
 <h1>Two-factor verification</h1><p>Complete TOTP authentication before editing tasks, invitations or payouts.</p>
 {!factor?<button className="button btnRed wide" onClick={()=>void enrol()}>Set up / continue MFA</button>:
 <form onSubmit={e=>void verify(e)}>{qr&&<img className="qrCode" src={qr} alt="Authenticator enrolment QR code"/>}
 <p>{message}</p><label>6-digit code<input inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></label>
 <button className="button btnRed wide">Verify and open admin <ArrowRight size={16}/></button></form>}
 {error&&<p className="error">{error}</p>}<Link to="/app">Back to member dashboard</Link></div></div>
}
