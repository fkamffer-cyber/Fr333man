import {authenticatedSupabase, publicSupabase, serviceSupabase} from '@/lib/supabase-server';
import {rejectCrossOrigin} from '@/lib/http';

const allowedConditions=new Set(['new','used','refurbished','digital','service']);
const sellerStatuses=new Set(['draft','pending_review','paused','sold_out','archived']);
const idPattern=/^[a-z0-9-]{3,90}$/i;
const text=(value:unknown,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const boolean=(value:unknown)=>value===true||value==='true'||value==='on'||value===1;
const slugify=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'item';
const unavailable=()=>Response.json({error:'Marketplace storage is temporarily unavailable'},{status:503});
function priceAmount(value:unknown){
  if(typeof value==='number'&&Number.isFinite(value))return Math.max(0,Math.round(value));
  const cleaned=text(value,40).replace(/[^0-9.,]/g,'').replace(',','.');const parsed=Number.parseFloat(cleaned);
  return Number.isFinite(parsed)?Math.max(0,Math.round(parsed*100)):NaN;
}
function mark(name:string){return name.split(/\s+/).map(word=>word[0]).join('').slice(0,4).toUpperCase()}
function publicImageUrl(path:string){const base=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');return base?`${base}/storage/v1/object/public/product-media/${path.split('/').map(encodeURIComponent).join('/')}`:''}
function normalize(row:Record<string,unknown>){
  const profile=(row.profiles&&typeof row.profiles==='object'?row.profiles:{}) as Record<string,unknown>;
  const shop=(row.shops&&typeof row.shops==='object'?row.shops:{}) as Record<string,unknown>;
  const images=Array.isArray(row.product_images)?row.product_images as Record<string,unknown>[]:[];
  const amount=Number(row.price_amount)||0;const currency=String(row.currency||'ZAR');
  return{id:String(row.id),slug:String(row.slug),name:String(row.name),description:String(row.description),category:String(row.category),condition:String(row.condition),stock:Number(row.stock)||0,status:String(row.status),complianceStatus:String(row.compliance_status),membershipEligible:Boolean(row.membership_eligible),checkoutEnabled:false,priceAmount:amount,currency,price:new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(amount/100),mark:mark(String(row.name)),owner:String(profile.display_name||profile.avatar_name||'People seller'),ownerHandle:`@${String(profile.avatar_name||'people')}`,region:String(profile.region||shop.region||''),shop:{name:String(shop.name||''),slug:String(shop.slug||'')},images:images.sort((a,b)=>Number(a.display_order)-Number(b.display_order)).map(image=>({url:publicImageUrl(String(image.storage_path)),alt:String(image.alt_text||row.name||'Product image')})).filter(image=>image.url)};
}
const productFields='id,slug,name,description,category,condition,price_amount,currency,stock,membership_eligible,compliance_status,status,shops!inner(name,slug,region,status),profiles!products_owner_id_fkey(avatar_name,display_name,region),product_images(storage_path,alt_text,display_order)';

export async function GET(req:Request){
  try{
    const url=new URL(req.url);const mine=url.searchParams.get('mine')==='true';const id=text(url.searchParams.get('id'),90);const owner=text(url.searchParams.get('owner'),40).replace(/^@/,'');if(id&&!idPattern.test(id))return Response.json({error:'Invalid product id'},{status:400});
    if(mine){
      const auth=await authenticatedSupabase(req);if(!auth)return Response.json({error:'Sign in to open your shop'},{status:401});
      let query=serviceSupabase().from('products').select(productFields).eq('owner_id',auth.user.id).order('updated_at',{ascending:false});if(id)query=query.or(`id.eq.${id},slug.eq.${id}`);
      const {data,error}=await query;if(error)throw error;return Response.json({products:(data??[]).map(row=>normalize(row as unknown as Record<string,unknown>))});
    }
    let query=publicSupabase().from('products').select(productFields).eq('status','published').eq('compliance_status','permitted').order('created_at',{ascending:false}).limit(100);
    if(id)query=query.or(`id.eq.${id},slug.eq.${id}`);if(owner)query=query.eq('profiles.avatar_name',owner);
    const {data,error}=await query;if(error)throw error;return Response.json({products:(data??[]).map(row=>normalize(row as unknown as Record<string,unknown>))});
  }catch{return unavailable()}
}

export async function POST(req:Request){
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  try{
    const auth=await authenticatedSupabase(req);if(!auth)return Response.json({error:'Sign in before managing a shop'},{status:401});
    const body=await req.json() as Record<string,unknown>;const action=text(body.action,30)||'product-create';const admin=serviceSupabase();
    const {data:profile,error:profileError}=await admin.from('profiles').select('avatar_name,display_name,region,trust_status').eq('user_id',auth.user.id).maybeSingle();if(profileError)throw profileError;
    if(!profile)return Response.json({error:'Complete your People profile before opening a shop'},{status:409});
    if(profile.trust_status!=='approved')return Response.json({error:'Your People profile must be approved before products can be submitted'},{status:403});
    const shopSlug=slugify(profile.avatar_name);const shopName=text(body.shopName,100)||`${profile.display_name||profile.avatar_name} Shop`;
    const {data:shop,error:shopError}=await admin.from('shops').upsert({owner_id:auth.user.id,slug:shopSlug,name:shopName,description:text(body.shopDescription,1000),region:profile.region||'Randburg',fulfilment_note:text(body.fulfilmentNote,500),returns_note:text(body.returnsNote,500),status:'active'},{onConflict:'owner_id'}).select('id,slug,name').single();if(shopError)throw shopError;
    if(action==='shop-upsert')return Response.json({ok:true,shop});
    if(action!=='product-create')return Response.json({error:'Unsupported marketplace action'},{status:400});
    const name=text(body.name||body.title,140);const description=text(body.description,3000);const category=text(body.category,80);const condition=allowedConditions.has(text(body.condition,30))?text(body.condition,30):'new';const amount=priceAmount(body.priceAmount??body.price);const stock=Math.max(0,Math.floor(Number(body.stock)||0));
    if(name.length<3||description.length<10||!category||!Number.isFinite(amount))return Response.json({error:'Name, description, category and a valid price are required'},{status:400});
    const slug=`${slugify(name)}-${crypto.randomUUID().slice(0,8)}`;
    const {data:product,error}=await admin.from('products').insert({shop_id:shop.id,owner_id:auth.user.id,slug,sku:text(body.sku,80)||null,name,description,category,condition,price_amount:amount,currency:'ZAR',stock,membership_eligible:boolean(body.membershipEligible),compliance_status:'pending_review',status:'pending_review'}).select('id,slug,status').single();if(error)throw error;
    return Response.json({ok:true,product},{status:201});
  }catch{return unavailable()}
}

export async function PATCH(req:Request){
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  try{
    const auth=await authenticatedSupabase(req);if(!auth)return Response.json({error:'Sign in before editing a product'},{status:401});const body=await req.json() as Record<string,unknown>;const id=text(body.id,90);if(!idPattern.test(id))return Response.json({error:'Valid product id is required'},{status:400});
    const updates:Record<string,unknown>={updated_at:new Date().toISOString()};const materialEdit=['name','description','category','condition','price','membershipEligible'].some(field=>body[field]!==undefined);if(body.name!==undefined){const name=text(body.name,140);if(name.length<3)return Response.json({error:'Product name must be at least 3 characters'},{status:400});updates.name=name}if(body.description!==undefined){const description=text(body.description,3000);if(description.length<10)return Response.json({error:'Product description must be at least 10 characters'},{status:400});updates.description=description}if(body.category!==undefined){const category=text(body.category,80);if(!category)return Response.json({error:'Product category is required'},{status:400});updates.category=category}if(body.condition!==undefined){const condition=text(body.condition,30);if(!allowedConditions.has(condition))return Response.json({error:'Unsupported product condition'},{status:400});updates.condition=condition}if(body.stock!==undefined){const stock=Number(body.stock);if(!Number.isFinite(stock)||stock<0)return Response.json({error:'Stock must be zero or greater'},{status:400});updates.stock=Math.floor(stock)}if(body.price!==undefined){const amount=priceAmount(body.price);if(!Number.isFinite(amount))return Response.json({error:'Valid price required'},{status:400});updates.price_amount=amount}if(body.status!==undefined){const status=text(body.status,30);if(!sellerStatuses.has(status))return Response.json({error:'Unsupported product status'},{status:400});updates.status=status}if(body.membershipEligible!==undefined)updates.membership_eligible=boolean(body.membershipEligible);if(materialEdit){updates.status='pending_review';updates.compliance_status='pending_review'}if(Object.keys(updates).length===1)return Response.json({error:'No supported product changes supplied'},{status:400});
    const {data,error}=await serviceSupabase().from('products').update(updates).eq('owner_id',auth.user.id).or(`id.eq.${id},slug.eq.${id}`).select('id,slug,status').maybeSingle();if(error)throw error;if(!data)return Response.json({error:'Product not found'},{status:404});return Response.json({ok:true,product:data});
  }catch{return unavailable()}
}
