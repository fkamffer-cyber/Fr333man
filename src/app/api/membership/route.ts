import {authenticatedSupabase, publicSupabase, serviceSupabase} from '@/lib/supabase-server';
import {rejectCrossOrigin} from '@/lib/http';

type PlanRow={
  id:string;slug:string;name:string;description:string;currency:string;monthly_amount:number|null;
  benefit_selection_limit:number;product_selection_limit:number;enrollment_open:boolean;billing_enabled:boolean;
};
type PrivatePlanRow=PlanRow&{paystack_plan_code:string|null;status:string};
type ItemRow={id:string;slug:string;item_type:'benefit'|'product';title:string;description:string;fulfillment_note:string};

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const selectionMonth=()=>`${new Date().toISOString().slice(0,7)}-01`;
const unavailable=()=>Response.json({error:'Membership service is temporarily unavailable'},{status:503});

async function planAndItems(slug:string,includePrivate=false){
  const client=includePrivate?serviceSupabase():publicSupabase();
  const response=includePrivate
    ?await client.from('membership_plans').select('id,slug,name,description,currency,monthly_amount,benefit_selection_limit,product_selection_limit,enrollment_open,billing_enabled,paystack_plan_code,status').eq('slug',slug).eq('status','active').maybeSingle()
    :await client.from('membership_plans').select('id,slug,name,description,currency,monthly_amount,benefit_selection_limit,product_selection_limit,enrollment_open,billing_enabled,status').eq('slug',slug).eq('status','active').maybeSingle();
  const plan=response.data as unknown as PrivatePlanRow|null;const planError=response.error;
  if(planError)throw planError;if(!plan)return null;
  const {data:links,error:linkError}=await client.from('membership_plan_items').select('catalog_item_id').eq('plan_id',plan.id);
  if(linkError)throw linkError;
  const ids=(links??[]).map((row:{catalog_item_id:string})=>row.catalog_item_id);
  if(!ids.length)return{plan,items:[] as ItemRow[]};
  const {data:items,error:itemError}=await client.from('membership_catalog_items').select('id,slug,item_type,title,description,fulfillment_note').in('id',ids).eq('status','active').order('item_type').order('title');
  if(itemError)throw itemError;return{plan,items:(items??[]) as ItemRow[]};
}

export async function GET(){
  try{
    const result=await planAndItems('people-membership');
    if(!result)return Response.json({error:'No membership plan is available'},{status:404});
    return Response.json(result);
  }catch{return unavailable()}
}

export async function POST(req:Request){
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  try{
    const auth=await authenticatedSupabase(req);if(!auth)return Response.json({error:'Sign in before managing membership'},{status:401});
    const body=await req.json() as {action?:unknown;plan?:unknown;selectionIds?:unknown;email?:unknown;policyAccepted?:unknown};
    const action=body.action==='checkout'?'checkout':'save-selections';
    const slug=typeof body.plan==='string'?body.plan:'people-membership';
    const result=await planAndItems(slug,true);if(!result)return Response.json({error:'Membership plan not found'},{status:404});
    const plan=result.plan as PrivatePlanRow;
    if(!plan.enrollment_open)return Response.json({error:'Membership enrolment is currently closed'},{status:409});
    const admin=serviceSupabase();
    const {data:membership,error:membershipError}=await admin.from('people_memberships').upsert({member_id:auth.user.id,plan_id:plan.id},{onConflict:'member_id'}).select('id,status').single();
    if(membershipError)throw membershipError;

    if(action==='save-selections'){
      const raw=Array.isArray(body.selectionIds)?body.selectionIds:[];
      const selectionIds=[...new Set(raw.filter((id):id is string=>typeof id==='string'&&uuidPattern.test(id)))];
      const allowed=new Map(result.items.map(item=>[item.id,item]));
      if(selectionIds.some(id=>!allowed.has(id)))return Response.json({error:'One or more selections are not available on this plan'},{status:400});
      const selected=selectionIds.map(id=>allowed.get(id)!);
      if(selected.filter(item=>item.item_type==='benefit').length>plan.benefit_selection_limit)return Response.json({error:`Choose up to ${plan.benefit_selection_limit} benefits`},{status:400});
      if(selected.filter(item=>item.item_type==='product').length>plan.product_selection_limit)return Response.json({error:`Choose up to ${plan.product_selection_limit} products`},{status:400});
      const month=selectionMonth();
      const {error:deleteError}=await admin.from('membership_selections').delete().eq('membership_id',membership.id).eq('selection_month',month);if(deleteError)throw deleteError;
      if(selectionIds.length){const {error:insertError}=await admin.from('membership_selections').insert(selectionIds.map(catalog_item_id=>({membership_id:membership.id,catalog_item_id,selection_month:month})));if(insertError)throw insertError}
      return Response.json({ok:true,membershipId:membership.id,status:membership.status,selectionMonth:month});
    }

    const email=typeof body.email==='string'?body.email.trim():'';
    if(!emailPattern.test(email))return Response.json({error:'A valid billing email is required'},{status:400});
    if(body.policyAccepted!==true)return Response.json({error:'Accept the membership terms and recurring billing notice'},{status:400});
    if(!plan.billing_enabled||!plan.paystack_plan_code||!plan.monthly_amount)return Response.json({configured:false,message:'Monthly billing is not live yet. Your membership choices have been retained.'});
    const secret=process.env.PAYSTACK_SECRET_KEY;if(!secret)return Response.json({configured:false,message:'Paystack membership billing is not connected yet.'});
    const reference=`membership-${crypto.randomUUID()}`;
    const origin=new URL(req.url).origin;
    const paystack=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({email,amount:plan.monthly_amount,plan:plan.paystack_plan_code,reference,callback_url:`${origin}/?view=Membership`,metadata:{membership_id:membership.id,member_id:auth.user.id,plan_slug:plan.slug}})});
    const payload=await paystack.json();if(!paystack.ok)return Response.json({error:'Paystack could not start the membership subscription'},{status:502});
    const {error:updateError}=await admin.from('people_memberships').update({status:'pending_payment',paystack_reference:reference}).eq('id',membership.id);if(updateError)throw updateError;
    return Response.json(payload,{status:paystack.status});
  }catch{return unavailable()}
}
