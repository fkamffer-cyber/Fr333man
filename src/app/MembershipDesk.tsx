"use client";

import {FormEvent, useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {authenticatedHeaders} from "./lib/supabase-browser";

type CatalogItem={id:string;slug:string;item_type:"benefit"|"product";title:string;description:string;fulfillment_note:string};
type MembershipPlan={id:string;slug:string;name:string;description:string;currency:string;monthly_amount:number|null;benefit_selection_limit:number;product_selection_limit:number;enrollment_open:boolean;billing_enabled:boolean};

const previewPlan:MembershipPlan={id:"preview",slug:"people-membership",name:"People Membership",description:"A monthly membership for People who want to support the community and choose practical benefits and products.",currency:"ZAR",monthly_amount:null,benefit_selection_limit:3,product_selection_limit:1,enrollment_open:true,billing_enabled:false};
const previewItems:CatalogItem[]=[
  {id:"preview-market",slug:"member-marketplace-benefit",item_type:"benefit",title:"Member marketplace access",description:"Create your People shop, list approved products and manage marketplace enquiries.",fulfillment_note:"Available while membership is active."},
  {id:"preview-projects",slug:"project-collaboration-benefit",item_type:"benefit",title:"Project collaboration",description:"Join open projects, accept tasks and publish progress from your People profile.",fulfillment_note:"Subject to each project's participation rules."},
  {id:"preview-session",slug:"monthly-community-session",item_type:"benefit",title:"Monthly community session",description:"Join the monthly online People session and member question period.",fulfillment_note:"Session details are sent to active members."},
  {id:"preview-promotion",slug:"profile-promotion-benefit",item_type:"benefit",title:"Profile and product promotion",description:"Choose an approved profile, cause or product for a community promotion slot.",fulfillment_note:"Promotion timing and channel remain subject to review."},
  {id:"preview-local",slug:"featured-local-product",item_type:"product",title:"Featured local product",description:"Choose one eligible product from the current monthly membership catalogue.",fulfillment_note:"Availability and fulfilment are confirmed before dispatch."},
  {id:"preview-digital",slug:"digital-learning-pack",item_type:"product",title:"Digital learning pack",description:"Choose a downloadable learning pack from the current member collection.",fulfillment_note:"Delivered to the verified membership email."},
];

function formatMonthly(plan:MembershipPlan){
  if(plan.monthly_amount===null)return "Monthly price to be confirmed";
  return new Intl.NumberFormat("en-ZA",{style:"currency",currency:plan.currency}).format(plan.monthly_amount/100)+" / month";
}

export default function MembershipDesk({show}:{show:(message:string)=>void}){
  const [plan,setPlan]=useState(previewPlan);const [items,setItems]=useState(previewItems);const [connected,setConnected]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);const [saving,setSaving]=useState(false);
  useEffect(()=>{const controller=new AbortController();void fetch("/api/membership",{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as {plan:MembershipPlan;items:CatalogItem[]};setPlan(data.plan);setItems(data.items);setConnected(true)}).catch(()=>undefined);return()=>controller.abort()},[]);
  const benefits=useMemo(()=>items.filter(item=>item.item_type==="benefit"),[items]);
  const products=useMemo(()=>items.filter(item=>item.item_type==="product"),[items]);
  const chosenBenefits=selected.filter(id=>benefits.some(item=>item.id===id)).length;
  const chosenProducts=selected.filter(id=>products.some(item=>item.id===id)).length;
  const toggle=(item:CatalogItem)=>{
    if(selected.includes(item.id)){setSelected(current=>current.filter(id=>id!==item.id));return}
    const limit=item.item_type==="benefit"?plan.benefit_selection_limit:plan.product_selection_limit;
    const count=item.item_type==="benefit"?chosenBenefits:chosenProducts;
    if(count>=limit){show(`Choose up to ${limit} ${item.item_type}${limit===1?"":"s"}`);return}
    setSelected(current=>[...current,item.id]);
  };
  const saveSelections=async()=>{
    if(!connected){show("Connect Supabase to save membership selections");return false}
    setSaving(true);try{const response=await fetch("/api/membership",{method:"POST",headers:{"Content-Type":"application/json",...(await authenticatedHeaders())},body:JSON.stringify({action:"save-selections",plan:plan.slug,selectionIds:selected})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"Could not save selections");show("Your monthly membership choices are saved");return true}catch(error){show(error instanceof Error?error.message:"Membership choices could not be saved");return false}finally{setSaving(false)}
  };
  const checkout=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!(await saveSelections()))return;const form=new FormData(event.currentTarget);setSaving(true);
    try{const response=await fetch("/api/membership",{method:"POST",headers:{"Content-Type":"application/json",...(await authenticatedHeaders())},body:JSON.stringify({action:"checkout",plan:plan.slug,email:form.get("email"),policyAccepted:form.get("policyAccepted")==="on"})});const result=await response.json() as {error?:string;message?:string;data?:{authorization_url?:string}};if(!response.ok)throw new Error(result.error||"Could not start membership");if(result.data?.authorization_url){window.location.assign(result.data.authorization_url);return}show(result.message||"Your choices are saved. Billing will open after plan approval.")}catch(error){show(error instanceof Error?error.message:"Membership checkout is unavailable")}finally{setSaving(false)}
  };
  return <section className="membership-shell">
    <header className="membership-hero"><div><p>PEOPLE MEMBERSHIP</p><h1>Choose what helps you participate.</h1><span>{plan.description}</span></div><aside><b>{formatMonthly(plan)}</b><span>Recurring monthly membership · cancel renewal from your account</span></aside></header>
    {!connected&&<div className="membership-preview"><b>Membership preview</b><span>The choices are visible now. Connect Supabase before People can save them.</span></div>}
    <div className="membership-layout"><section>
      <MembershipGroup title="Select your benefits" note={`Choose up to ${plan.benefit_selection_limit}`} items={benefits} selected={selected} onToggle={toggle}/>
      <MembershipGroup title="Select included products" note={`Choose up to ${plan.product_selection_limit} each month`} items={products} selected={selected} onToggle={toggle}/>
    </section><aside className="membership-summary"><p>YOUR MONTHLY CHOICES</p><h2>{selected.length} selected</h2><dl><div><dt>Benefits</dt><dd>{chosenBenefits} / {plan.benefit_selection_limit}</dd></div><div><dt>Products</dt><dd>{chosenProducts} / {plan.product_selection_limit}</dd></div><div><dt>Billing</dt><dd>{plan.billing_enabled?"Monthly":"Awaiting activation"}</dd></div></dl>
      <form onSubmit={checkout}><label>Billing email<input name="email" type="email" required autoComplete="email"/></label><label className="check"><input name="policyAccepted" type="checkbox" required/> I accept the <Link href="/policies/terms">membership terms</Link> and recurring billing notice.</label><button className="primary" disabled={saving||!plan.enrollment_open}>{saving?"Saving…":plan.billing_enabled?"Save and start membership":"Save membership choices"}</button></form>
      <small>Benefits and product availability can change by month and region. A substitution or carry-over is never made without the member&apos;s confirmation.</small>
    </aside></div>
  </section>
}

function MembershipGroup({title,note,items,selected,onToggle}:{title:string;note:string;items:CatalogItem[];selected:string[];onToggle:(item:CatalogItem)=>void}){
  return <section className="membership-group"><header><div><p>MONTHLY CATALOGUE</p><h2>{title}</h2></div><span>{note}</span></header><div className="membership-grid">{items.map(item=><button type="button" className={selected.includes(item.id)?"selected":""} onClick={()=>onToggle(item)} key={item.id}><i>{selected.includes(item.id)?"✓":"+"}</i><b>{item.title}</b><span>{item.description}</span><small>{item.fulfillment_note}</small></button>)}</div></section>
}
