import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
export const service = createClient(url, serviceKey, {auth:{persistSession:false}});
export const corsHeaders = {
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Content-Type':'application/json'
};
export function respond(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:corsHeaders});}
export function handleOptions(request:Request){return request.method==='OPTIONS' ? new Response(null,{status:204,headers:corsHeaders}):null;}
export async function sha256(value:string){
 const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function failure(error:unknown){
 const message=error instanceof Error?error.message:'Request failed';
 return respond({error:message},400);
}
