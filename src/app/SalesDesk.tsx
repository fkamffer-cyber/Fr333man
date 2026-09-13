'use client';

import {useRef, useState} from 'react';
import {authenticatedHeaders} from './lib/supabase-browser';

const channels=[
  {name:'Facebook Marketplace',url:'https://www.facebook.com/marketplace/create/item',note:'Open seller listing',state:'Account sign-in required'},
  {name:'Gumtree South Africa',url:'https://www.gumtree.co.za/post.html',note:'Post an advert',state:'Account sign-in required'},
  {name:'Bob Shop',url:'https://www.bobshop.co.za/sell',note:'Open seller centre',state:'Seller approval required'},
  {name:'eBay',url:'https://www.ebay.com/sl/sell',note:'Open seller hub',state:'API connection required'},
];

export default function SalesDesk({show}:{show:(message:string)=>void}){
  const input=useRef<HTMLInputElement>(null);
  const [uploaded,setUploaded]=useState(false);
  const [filter,setFilter]=useState('All');
  const stages=['All','Draft','Published','Enquiry','Sold'];
  const upload=async(file?:File)=>{
    if(!file)return;
    const form=new FormData();form.set('file',file);
    const response=await fetch('/api/upload',{method:'POST',headers:await authenticatedHeaders(),body:form});
    if(response.ok){setUploaded(true);show('Sales workbook secured and attached to your profile')}else show('Workbook upload failed; the original file stayed on your device');
  };
  return <section className="operations-shell sales-desk">
    <header className="operations-hero"><div><p>FRANCOIS · PROFILE SALES NODE</p><h1>Sales inventory</h1><span>One supervised workspace for stock, adverts and buyer conversations.</span></div><div className="hero-actions"><input ref={input} hidden type="file" accept=".xlsx,.xls,.csv" onChange={e=>void upload(e.target.files?.[0])}/><button onClick={()=>input.current?.click()}>{uploaded?'Workbook attached ✓':'Attach master workbook'}</button><button className="primary" onClick={()=>show('New inventory item form is available in Administration')}>+ Add inventory</button></div></header>
    <div className="metric-grid"><article><small>INVENTORY RECORDS</small><b>67</b><span>FS-0001 to FS-0067</span></article><article><small>ASKING VALUE</small><b>R245,100</b><span>Before offers and fees</span></article><article><small>PRODUCT PHOTOS</small><b>180</b><span>Matched and grouped</span></article><article><small>TARGETED SEARCHES</small><b>18</b><span>Product-specific groups</span></article></div>
    <div className="operations-grid"><article className="operations-card wide"><div className="panel-head"><div><p>LISTING CONTROL</p><h2>Publishing channels</h2></div><span className="state pending">Connections needed</span></div><div className="channel-table"><div className="table-row table-header"><span>Channel</span><span>Status</span><span>Action</span></div>{channels.map(channel=><div className="table-row" key={channel.name}><b>{channel.name}</b><span>{channel.state}</span><a href={channel.url} target="_blank" rel="noreferrer">{channel.note} ↗</a></div>)}</div><div className="stage-filter" aria-label="Inventory stage">{stages.map(stage=><button className={filter===stage?'active':''} onClick={()=>setFilter(stage)} key={stage}>{stage}</button>)}</div><div className="empty-work"><b>No {filter.toLowerCase()==='all'?'live':filter.toLowerCase()} listing data connected yet.</b><span>Attach the master workbook, then connect each seller account. Publication and price acceptance remain under your approval.</span></div></article>
      <aside className="operations-card attention"><p>LAUNCH INPUTS</p><h2>Three details still needed</h2><ol><li>Collection suburb shown to buyers</li><li>Courier or freight eligibility per item</li><li>Signed-in seller accounts</li></ol><button onClick={()=>show('Launch detail checklist opened')}>Review launch checklist</button></aside>
    </div>
    <article className="operations-card buyer-centre"><div><p>BUYER COMMUNICATIONS</p><h2>Supervised inbox</h2><span>Alerts and reply drafts can be centralised. Replies, final prices, addresses and payment confirmation always require approval.</span></div><div className="sla"><b>10 min</b><span>Gumtree response target</span></div><div className="pipeline"><span>New enquiries <b>0</b></span><span>Offers <b>0</b></span><span>Needs reply <b>0</b></span></div><button onClick={()=>show('Connect Gmail and seller accounts to activate the buyer inbox')}>Connect notification inbox</button></article>
  </section>;
}
