import {createClient, type SupabaseClient} from '@supabase/supabase-js';

let client:SupabaseClient|null=null;
export function getSupabaseBrowser(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;
  client??=createClient(url,key,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true}});
  return client;
}
export async function authenticatedHeaders():Promise<Record<string,string>>{
  const supabase=getSupabaseBrowser();
  if(!supabase)return {};
  const {data}=await supabase.auth.getSession();
  return data.session?.access_token?{Authorization:`Bearer ${data.session.access_token}`}:{ };
}
