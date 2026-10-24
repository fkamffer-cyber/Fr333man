import {authenticatedSupabase, publicSupabase, serviceSupabase} from '@/lib/supabase-server';
import {rejectCrossOrigin} from '@/lib/http';

const contentEntities=new Set(['post','project','task','product','promotion','support','consent','dispute','broadcast']);
const statuses=new Set(['draft','active','pending_review','archived']);
function text(value:unknown,max=180){return typeof value==='string'?value.trim().slice(0,max):''}
function unavailable(){return Response.json({error:'Community storage is temporarily unavailable'},{status:503})}

export async function GET(req:Request){
  try{
    const url=new URL(req.url);const id=url.searchParams.get('id');
    if(id){
      if(!/^[0-9a-f-]{36}$/i.test(id))return Response.json({error:'Invitation not found'},{status:404});
      const {data,error}=await serviceSupabase().from('invitations').select('id,recipient_name,personal_message,source_url,source_metadata,status,expires_at').eq('id',id).eq('status','unclaimed').gt('expires_at',new Date().toISOString()).maybeSingle();
      if(error||!data)return Response.json({error:'Invitation not found'},{status:404});
      return Response.json({records:[{id:data.id,entity:'invitation',title:data.recipient_name,data:{name:data.recipient_name,message:data.personal_message,sourceUrl:data.source_url,...(data.source_metadata as object)},status:data.status}]});
    }
    const entity=url.searchParams.get('entity');if(entity&&!contentEntities.has(entity))return Response.json({error:'Unsupported record type'},{status:400});
    const mine=url.searchParams.get('mine')==='true';const auth=mine?await authenticatedSupabase(req):null;if(mine&&!auth)return Response.json({error:'Sign in required'},{status:401});
    const client=mine?serviceSupabase():publicSupabase();let query=client.from('community_records').select('id,owner_id,entity,title,data,status,created_at').eq('status','active').order('created_at',{ascending:false}).limit(100);if(entity)query=query.eq('entity',entity);if(mine&&auth)query=query.eq('owner_id',auth.user.id);
    const {data,error}=await query;if(error)throw error;const ownerIds=Array.from(new Set((data??[]).map(row=>row.owner_id)));const {data:authors}=ownerIds.length?await client.from('profiles').select('user_id,avatar_name,display_name,region').in('user_id',ownerIds):{data:[]};const authorMap=new Map((authors??[]).map(author=>[author.user_id,author]));return Response.json({records:(data??[]).map(row=>({...row,author:authorMap.get(row.owner_id)??null}))});
  }catch{return unavailable()}
}

export async function POST(req:Request){
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  try{
    const auth=await authenticatedSupabase(req);if(!auth)return Response.json({error:'Sign in required'},{status:401});
    const body=await req.json() as {entity?:unknown;title?:unknown;data?:Record<string,unknown>;status?:unknown};
    const entity=text(body.entity,40);const title=text(body.title);const data=body.data&&typeof body.data==='object'?body.data:{};if(!entity||!title)return Response.json({error:'Record type and title are required'},{status:400});
    const admin=serviceSupabase();
    if(entity==='profile'){
      const avatar=text(data.avatar,40);const region=text(data.region,80)||'Randburg';if(!/^[a-zA-Z0-9._-]{3,40}$/.test(avatar))return Response.json({error:'Choose a 3–40 character avatar name using letters, numbers, dots, dashes or underscores'},{status:400});
      const memberType=['profile','project','administration'].includes(String(data.memberType))?String(data.memberType):'profile';
      const {error:profileError}=await admin.from('profiles').upsert({user_id:auth.user.id,avatar_name:avatar,display_name:avatar,region,member_type:memberType,trust_status:'pending_review',is_public:false},{onConflict:'user_id'});if(profileError)throw profileError;
      const now=new Date().toISOString();const identityDocumentPath=text(data.identityDocumentPath,500);const witnessSelfiePath=text(data.witnessSelfiePath,500);if(!identityDocumentPath||!witnessSelfiePath)return Response.json({error:'Identity evidence and a joint member-witness selfie are required'},{status:400});const {error:submissionError}=await admin.from('onboarding_submissions').upsert({user_id:auth.user.id,answers:Array.isArray(data.answers)?data.answers.slice(0,10):[],witness_handle:text(data.witness,80),identity_document_path:identityDocumentPath,witness_selfie_path:witnessSelfiePath,identity_consent_at:data.identityConsent?now:null,witness_consent_at:data.witnessConsent?now:null,terms_accepted_at:data.terms?now:null,privacy_accepted_at:data.privacy?now:null,fee_acknowledged_at:data.fee?now:null,status:'pending_identity_review',submitted_at:now,updated_at:now},{onConflict:'user_id'});if(submissionError)throw submissionError;
      const shopSlug=avatar.toLowerCase().replace(/[^a-z0-9-]+/g,'-');const {error:shopError}=await admin.from('shops').upsert({owner_id:auth.user.id,slug:shopSlug,name:`${avatar} Shop`,description:'Products and offers from this People member.',region,status:'draft'},{onConflict:'owner_id'});if(shopError)throw shopError;
      const inviteId=text(data.inviteId,36);if(/^[0-9a-f-]{36}$/i.test(inviteId)){const {error:claimError}=await admin.from('invitations').update({status:'claimed',claimed_by:auth.user.id}).eq('id',inviteId).eq('status','unclaimed').gt('expires_at',now);if(claimError)throw claimError}
      return Response.json({ok:true,id:auth.user.id});
    }
    if(entity==='invitation'){
      const name=text(data.name||title,120);const message=text(data.message,500);const sourceUrl=text(data.sourceUrl,2048);try{const parsed=new URL(sourceUrl);if(!['http:','https:'].includes(parsed.protocol))throw new Error()}catch{return Response.json({error:'A valid public source URL is required'},{status:400})}
      if(!name||!message)return Response.json({error:'Recipient name and personal message are required'},{status:400});
      const metadata={source:text(data.source,40),description:text(data.description,500),image:text(data.image,2048),claimed:false};const {data:created,error}=await admin.from('invitations').insert({inviter_id:auth.user.id,recipient_name:name,personal_message:message,source_url:sourceUrl,source_metadata:metadata}).select('id').single();if(error)throw error;return Response.json({ok:true,id:created.id});
    }
    if(!contentEntities.has(entity))return Response.json({error:'Unsupported record type'},{status:400});const status=statuses.has(String(body.status))?String(body.status):'active';const {data:created,error}=await admin.from('community_records').insert({entity,owner_id:auth.user.id,title,data,status}).select('id').single();if(error)throw error;return Response.json({ok:true,id:created.id});
  }catch{return unavailable()}
}

export async function PATCH(req:Request){
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  try{
    const auth=await authenticatedSupabase(req);if(!auth)return Response.json({error:'Sign in required'},{status:401});const body=await req.json() as {id?:unknown;title?:unknown;data?:Record<string,unknown>;status?:unknown};const id=Number(body.id);if(!Number.isSafeInteger(id)||id<1)return Response.json({error:'Valid record id required'},{status:400});
    const updates:Record<string,unknown>={updated_at:new Date().toISOString()};if(body.title!==undefined)updates.title=text(body.title);if(body.data&&typeof body.data==='object')updates.data=body.data;if(body.status!==undefined&&statuses.has(String(body.status)))updates.status=String(body.status);
    const {data,error}=await serviceSupabase().from('community_records').update(updates).eq('id',id).eq('owner_id',auth.user.id).select('id').maybeSingle();if(error)throw error;if(!data)return Response.json({error:'Record not found'},{status:404});return Response.json({ok:true,id:data.id});
  }catch{return unavailable()}
}
