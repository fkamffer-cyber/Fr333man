import {createClient, type SupabaseClient} from '@supabase/supabase-js';

declare global {
  interface Window {
    __FR333MAN_SUPABASE_CONFIG__?: {
      url?: string;
      publishableKey?: string;
    };
  }
}

let client:SupabaseClient|null=null;
export function getSupabaseBrowser(){
  const runtimeConfig =
    typeof window === 'undefined'
      ? undefined
      : window.__FR333MAN_SUPABASE_CONFIG__;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||runtimeConfig?.url;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||runtimeConfig?.publishableKey;
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
