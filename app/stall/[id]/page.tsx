import type {Metadata} from 'next';
import Link from 'next/link';
import {vendorFor} from '@/app/vendors';
import VendorActions from './VendorActions';

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params; const vendor=vendorFor(Number(id));
  return vendor?{title:`${vendor.name} · Stall ${id} · Cowboy Town`,description:vendor.about,openGraph:{title:vendor.name,description:vendor.tagline,images:[]},twitter:{card:'summary',title:vendor.name,description:vendor.tagline,images:[]}}:{title:'Available stall · Cowboy Town',description:'Apply to trade at Cowboy Town Market.'};
}

export default async function StallPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params; const n=Number(id); const vendor=vendorFor(n);
  if(!vendor)return <main className="available-page"><Link href="/">← Back to market map</Link><div><p>STALL {String(n).padStart(2,'0')}</p><h1>This spot is<br/>ready for you.</h1><span>{n%10>=7?'Covered position · R140 per day':'Open gazebo position · R70 per day'}</span><Link className="vendor-buy" href="/#apply">Apply for this stall →</Link></div></main>;
  return <main className="vendor-page" style={{'--vendor':vendor.accent} as React.CSSProperties}>
    <nav><Link href="/">← Market map</Link><span>STALL {String(n).padStart(2,'0')} · COWBOY TOWN</span><a href={`https://quickchart.io/qr?text=${encodeURIComponent(`https://cowboytown.market/stall/${n}`)}&size=300`}>QR ↗</a></nav>
    <header className="vendor-hero"><img src={vendor.image} alt={`${vendor.name} market stall`}/><div className="vendor-veil"></div><div className="vendor-title"><p>{vendor.category.toUpperCase()}</p><h1>{vendor.name}</h1><h2>{vendor.tagline}</h2></div></header>
    <section className="vendor-story"><div><p className="vendor-kicker">MEET THE MAKER</p><h2>Made locally.<br/>Shared at the market.</h2></div><div><p>{vendor.about}</p><div className="vendor-links"><a href={`https://instagram.com/${vendor.instagram.replace('@','')}`}>{vendor.instagram} ↗</a><a href={vendor.website}>Visit website ↗</a></div></div></section>
    {n===1&&<FreemanConcept/>}
    <section className="vendor-products"><div className="product-head"><div><p className="vendor-kicker">SHOP THE STALL</p><h2>Market favourites</h2></div><span>Order online · Collect at Stall {String(n).padStart(2,'0')}</span></div><div className="visual-products">{vendor.products.map((p,i)=><article key={p.name}><div className={`product-photo product-photo-${i}`}><b>{p.name.split(' ')[0]}</b><span>0{i+1}</span></div><p>{p.description}</p><h3>{p.name}</h3><VendorActions vendor={vendor.name} product={p.name} price={p.price}/></article>)}</div></section>
    <section className="visit-strip"><div><p className="vendor-kicker">FIND US THIS SUNDAY</p><h2>Stall {String(n).padStart(2,'0')} · Cowboy Town</h2><p>09:00–16:00 · 1 McLean Street, West Village, Krugersdorp</p></div><img src={`https://quickchart.io/qr?text=${encodeURIComponent(`https://cowboytown.market/stall/${n}`)}&size=180`} alt={`QR code for ${vendor.name}`}/><Link href="/">View on the aerial map →</Link></section>
  </main>;
}

function FreemanConcept(){return <section className="freeman-concept"><div className="conversation-visual"><span>QUESTION OF THE DAY</span><h2>Would you believe what you believe if you questioned those you believe?</h2><p>Scan. Answer. Join the conversation.</p></div><div className="concept-stations"><article><b>NPK<span>432</span></b><p>Awaken your soil</p><small>Biological starter · Root health · Compost activation</small></article><article><b>CDS<span>water</span></b><p>Know what is in your water</p><small>Purification kits · Live demonstrations</small></article><article><b>Fido</b><p>Food for good dogs</p><small>Natural dog food and market-day treats</small></article></div><div className="conversation-note"><p className="vendor-kicker">THE CONVERSATION PIT</p><h3>Two chairs. One question.<br/>A respectful 30-minute discussion.</h3><p>Visitors can explore the research station, watch live conversations and add their own answer through the stall QR.</p></div></section>}
