import {service,respond,handleOptions,sha256,failure} from '../_shared/common.ts';

// The only registration route; public Auth sign-up MUST be disabled in project settings.
Deno.serve(async request=>{
 const preflight=handleOptions(request);if(preflight)return preflight;
 let claimId:string|undefined;let userId:string|undefined;
 try{
  if(request.method!=='POST')return respond({error:'Method not allowed'},405);
  const body=await request.json();
  const username=String(body.username||'').trim().toLowerCase();
  const first=String(body.first_name||'').trim();
  const last=String(body.last_name||'').trim();
  const password=String(body.password||'');
  const token=String(body.token||'');
  if(!/^[a-z0-9_]{3,24}$/.test(username))throw Error('Username must be 3–24 letters, numbers or underscores.');
  if(first.length<2||last.length<2||first.length>60||last.length>60)
   throw Error('Please enter your first and last name.');
  if(password.length<12||password.length>128)throw Error('Password must contain 12–128 characters.');
  if(!/^[0-9a-f]{64}$/.test(token))throw Error('A valid invitation link is required.');
  if(!body.consent_terms||!body.consent_privacy||!body.is_adult)
   throw Error('You must be over 18 and accept the Terms and Privacy Policy.');
  const hash=await sha256(token);
  const claimed=await service.rpc('claim_invitation',{p_hash:hash});
  if(claimed.error||!claimed.data)throw Error('Invitation expired or already used.');
  claimId=String(claimed.data);
  // A synthetic login identifier removes email verification without accepting
  // anonymous public sign-ups. These addresses must never be used to send mail.
  const email=username+'@accounts.yrewards.invalid';
  const created=await service.auth.admin.createUser({
   email,password,email_confirm:true,
   user_metadata:{username,full_name:first+' '+last}
  });
  if(created.error||!created.data.user)throw created.error||Error('Could not register member.');
  userId=created.data.user.id;
  const redeemed=await service.from('invitations')
   .update({redeemed_by:userId}).eq('id',claimId).is('redeemed_by',null).select('id').single();
  if(redeemed.error||!redeemed.data)throw Error('Invitation could not be redeemed.');
  return respond({ok:true,message:'Account created. Sign in with your username and password.'});
 }catch(e){
  if(userId)await service.auth.admin.deleteUser(userId);
  if(claimId)await service.from('invitations').update({claimed_at:null,redeemed_by:null}).eq('id',claimId);
  return failure(e);
 }
});
