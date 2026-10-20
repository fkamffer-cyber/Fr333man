/* eslint-disable @next/next/no-html-link-for-pages -- public shop uses full navigation */
import type {Metadata} from 'next';
import {findPublicShop} from '@/lib/public-directory';

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const shop=await findPublicShop(decodeURIComponent(slug));return shop?{title:`${shop.name} · FR333MAN`,description:shop.description}:{title:'People Shop · FR333MAN'}}

export default async function ShopPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const shop=await findPublicShop(decodeURIComponent(slug));
  if(!shop)return <main className="public-person missing"><a href="/">← FR333MAN</a><h1>This People shop is not available.</h1><p>The member may still be completing verification or product review.</p></main>;
  return <main className="shop-page">
    <nav><a href="/">FR<span>333</span>MAN</a><div><a href={`/people/${shop.owner.handle.slice(1)}`}>People page</a><a href="/?view=Marketplace">Marketplace</a></div></nav>
    <header><p>VERIFIED PEOPLE SHOP · {shop.region.toUpperCase()}</p><h1>{shop.name}</h1><span>{shop.description}</span><a href={`/people/${shop.owner.handle.slice(1)}`}>Owned by {shop.owner.name} · {shop.owner.handle}</a></header>
    <section><div className="shop-intro"><div><p>AVAILABLE FROM THIS MEMBER</p><h2>{shop.products.length} {shop.products.length===1?'offer':'offers'}</h2></div><aside><b>Fulfilment</b><span>{shop.fulfilmentNote||'Confirm collection or delivery directly with the seller.'}</span><b>Returns</b><span>{shop.returnsNote||'The seller’s published return terms apply.'}</span></aside></div>
      {shop.products.length?<div className="market-grid">{shop.products.map((product,index)=><article className="market-card" key={product.id}><div className={`product-visual product-${index%4}`}>{product.images?.[0]?.url?<img src={product.images[0].url} alt={product.images[0].alt}/>:<span>{product.mark}</span>}<em>{product.category}</em></div><div><small>{product.condition?.toUpperCase()} · {product.stock??0} AVAILABLE</small><h2>{product.name}</h2><p>{product.description}</p><div className="price"><b>{product.price}</b></div><a className="primary shop-product-link" href={`/products/${product.slug||product.id}`}>View product</a></div></article>)}</div>:<div className="empty-work"><b>No approved products yet.</b><span>This shop is active. Products will appear after marketplace compliance review.</span></div>}
    </section>
    <footer>Each People member owns and manages their own shop. FR333MAN provides the marketplace and verification layer.</footer>
  </main>
}
