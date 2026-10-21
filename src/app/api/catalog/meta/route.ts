import {publicSupabase} from '@/lib/supabase-server';

const csv=(value:unknown)=>`"${String(value??'').replaceAll('"','""').replace(/[\r\n]+/g,' ').trim()}"`;
function imageUrl(path:string){const base=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');return base?`${base}/storage/v1/object/public/product-media/${path.split('/').map(encodeURIComponent).join('/')}`:''}
function condition(value:unknown){return value==='new'?'new':value==='refurbished'?'refurbished':'used'}

export async function GET(req:Request){
  try{
    const {data,error}=await publicSupabase().from('products').select('id,slug,name,description,category,condition,price_amount,currency,stock,shops!inner(name,status),product_images(storage_path,display_order)').eq('status','published').eq('compliance_status','permitted').gt('stock',0).eq('shops.status','active').order('updated_at',{ascending:false}).limit(5000);
    if(error)throw error;const origin=(process.env.NEXT_PUBLIC_SITE_URL||new URL(req.url).origin).replace(/\/$/,'');
    const headers=['id','title','description','availability','condition','price','link','image_link','brand','product_type','identifier_exists'];
    const rows=(data??[]).flatMap(raw=>{const row=raw as unknown as Record<string,unknown>;const images=(Array.isArray(row.product_images)?row.product_images:[]) as Array<Record<string,unknown>>;const image=images.sort((a,b)=>Number(a.display_order)-Number(b.display_order))[0];if(!image?.storage_path)return[];const shop=(row.shops&&typeof row.shops==='object'?row.shops:{}) as Record<string,unknown>;return [[row.id,row.name,row.description,'in stock',condition(row.condition),`${(Number(row.price_amount)||0)/100} ${String(row.currency||'ZAR')}`,`${origin}/products/${encodeURIComponent(String(row.slug||row.id))}`,imageUrl(String(image.storage_path)),String(shop.name||'FR333MAN member shop'),String(row.category||'Classifieds'),'no']]});
    const body=[headers,...rows].map(row=>row.map(csv).join(',')).join('\r\n');
    return new Response(body,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'inline; filename="fr333man-meta-catalog.csv"','Cache-Control':'public, max-age=300'}});
  }catch{return Response.json({error:'The community catalogue feed is unavailable until Supabase is connected'},{status:503})}
}
