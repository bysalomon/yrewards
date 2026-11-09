import {Link,Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {LoaderCircle} from 'lucide-react';
import {useAuth} from './AuthContext';
import {configured} from './lib';
import {Landing,InfoPage} from './pages/Landing';
import {Login,Invitation,AdminMfa} from './pages/Auth';
import {MemberLayout,Dashboard,TaskDay,WalletPage} from './pages/Member';
import {AdminPage} from './pages/Admin';
function Protected({adminOnly=false,children}:{adminOnly?:boolean;children:React.ReactNode}){
 const {user,profile,admin,loading}=useAuth();const loc=useLocation();
 if(loading)return <div className="centerScreen"><LoaderCircle className="spin"/> Loading your workspace…</div>;
 if(!user)return <Navigate to="/login" replace state={{from:loc.pathname}}/>;
 if(profile?.status==='suspended')return <div className="centerScreen"><h2>Account suspended</h2><p>Contact support for assistance.</p></div>;
 if(adminOnly&&!admin)return <Navigate to="/app" replace/>;
 return <>{children}</>;
}
export function App(){return <>
 {!configured&&<div className="setupBanner">YRewards is awaiting its own Supabase environment. <Link to="/setup">Setup instructions</Link></div>}
 <Routes>
  <Route path="/" element={<Landing/>}/>
  <Route path="/login" element={<Login/>}/>
  <Route path="/invitation" element={<Invitation/>}/>
  <Route path="/admin/mfa" element={<Protected adminOnly><AdminMfa/></Protected>}/>
  <Route path="/app" element={<Protected><MemberLayout/></Protected>}>
   <Route index element={<Dashboard/>}/>
   <Route path="tasks/:day" element={<TaskDay/>}/>
   <Route path="wallet" element={<WalletPage/>}/>
  </Route>
  <Route path="/admin" element={<Protected adminOnly><MemberLayout adminArea/></Protected>}>
   <Route index element={<AdminPage/>}/>
  </Route>
  <Route path="/:topic" element={<InfoPage/>}/>
  <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes>
 </>}
