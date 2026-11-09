import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {User} from '@supabase/supabase-js';
import {configured,supabase,type Profile} from './lib';
type SessionContext={user:User|null;profile:Profile|null;admin:boolean;loading:boolean;refresh:()=>Promise<void>;signOut:()=>Promise<void>};
const AuthCtx=createContext<SessionContext>({user:null,profile:null,admin:false,loading:true,refresh:async()=>{},signOut:async()=>{}});
export function AuthProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null);const [profile,setProfile]=useState<Profile|null>(null);
 const [admin,setAdmin]=useState(false);const [loading,setLoading]=useState(true);
 async function refresh(){
  if(!configured){setLoading(false);return}
  const {data:{user:current}}=await supabase.auth.getUser();setUser(current);
  if(current){
   const [p,a]=await Promise.all([
    supabase.from('profiles').select('*').eq('id',current.id).maybeSingle(),
    supabase.rpc('is_admin')]);
   setProfile(p.data as Profile|null);setAdmin(a.data===true);
  }else{setProfile(null);setAdmin(false)}
  setLoading(false);
 }
 useEffect(()=>{void refresh();const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{
  // Avoid calling Auth within the synchronous auth callback (deadlock).
  queueMicrotask(()=>void refresh());
 });return()=>subscription.unsubscribe()},[]);
 const value=useMemo(()=>({user,profile,admin,loading,refresh,signOut:async()=>{await supabase.auth.signOut();setUser(null);setProfile(null);setAdmin(false)}}),[user,profile,admin,loading]);
 return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth=()=>useContext(AuthCtx);
