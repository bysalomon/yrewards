import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import {service,respond,handleOptions,sha256,failure} from '../_shared/common.ts';

Deno.serve(async request=>{
 const preflight=handleOptions(request);if(preflight)return preflight;
 try{
  if(request.method!=='POST')return respond({error:'Method not allowed'},405);
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))return respond({error:'Sign in required'},401);
  const caller=createClient(Deno.env.get('SUPABASE_URL')||'',
  Deno.env.get('SUPABASE_ANON_KEY')||'',{
    global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:userResponse,error:userError}=await caller.auth.getUser();
  if(userError||!userResponse.user) return respond({error:'Sign in required'},401);
  const admin=await caller.rpc('admin_with_mfa');
  if(admin.error||admin.data!==true)return respond({error:'Admin MFA required'},403);
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
  const token_hash=await sha256(token);
  const {error}=await service.from('invitations').insert({
    token_hash,created_by:userResponse.user.id
  });
  if(error)throw error;
  return respond({token,expires_in_days:7});
 }catch(e){return failure(e)}
});
