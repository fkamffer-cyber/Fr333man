import {serviceSupabase} from '@/lib/supabase-server';

type PaystackEvent={
  event?:string;
  data?:{
    id?:number|string;
    reference?:string;
    status?:string;
    subscription_code?:string;
    email_token?:string;
    customer?:{customer_code?:string};
    subscription?:{subscription_code?:string};
    metadata?:Record<string,unknown>|string;
  };
};

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function hexToBytes(value:string){if(!/^[0-9a-f]{128}$/i.test(value))return null;return new Uint8Array(value.match(/../g)!.map(pair=>Number.parseInt(pair,16)))}
async function validSignature(body:string,signature:string,secret:string){
  const supplied=hexToBytes(signature);if(!supplied)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-512'},false,['verify']);
  return crypto.subtle.verify('HMAC',key,supplied,new TextEncoder().encode(body));
}
function metadata(value:unknown){
  if(value&&typeof value==='object')return value as Record<string,unknown>;
  if(typeof value==='string'){try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'?parsed as Record<string,unknown>:{};}catch{return{}}}
  return{};
}

export async function POST(req:Request){
  const secret=process.env.PAYSTACK_SECRET_KEY;if(!secret)return Response.json({error:'Webhook is not configured'},{status:503});
  const signature=req.headers.get('x-paystack-signature')??'';const raw=await req.text();
  if(!signature||!(await validSignature(raw,signature,secret)))return Response.json({error:'Invalid signature'},{status:401});
  try{
    const event=JSON.parse(raw) as PaystackEvent;const type=event.event??'unknown';const data=event.data??{};const meta=metadata(data.metadata);
    const membershipId=typeof meta.membership_id==='string'&&uuidPattern.test(meta.membership_id)?meta.membership_id:null;
    const subscriptionCode=data.subscription_code??data.subscription?.subscription_code??null;
    const eventKey=`${type}:${data.id??data.reference??signature}`;
    const admin=serviceSupabase();
    const {error:eventError}=await admin.from('membership_payment_events').insert({event_key:eventKey,event_type:type,membership_id:membershipId,paystack_reference:data.reference??null,payload:event});
    if(eventError){if(eventError.code==='23505')return Response.json({ok:true,duplicate:true});throw eventError}
    let status:string|undefined;
    if(type==='subscription.create'||type==='charge.success')status='active';
    else if(type==='invoice.payment_failed')status='past_due';
    else if(type==='subscription.not_renew')status='cancel_at_period_end';
    else if(type==='subscription.disable')status='cancelled';
    const updates:Record<string,unknown>={};if(status)updates.status=status;
    if(subscriptionCode)updates.paystack_subscription_code=subscriptionCode;
    if(data.email_token)updates.paystack_email_token=data.email_token;
    if(data.customer?.customer_code)updates.paystack_customer_code=data.customer.customer_code;
    if(Object.keys(updates).length){
      let query=admin.from('people_memberships').update(updates);
      if(membershipId)query=query.eq('id',membershipId);else if(subscriptionCode)query=query.eq('paystack_subscription_code',subscriptionCode);else if(data.reference)query=query.eq('paystack_reference',data.reference);else return Response.json({ok:true,matched:false});
      const {error:updateError}=await query;if(updateError)throw updateError;
    }
    return Response.json({ok:true});
  }catch{return Response.json({error:'Webhook processing failed'},{status:500})}
}
