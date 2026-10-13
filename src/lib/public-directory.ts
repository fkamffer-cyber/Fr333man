import {publicSupabase} from './supabase-server';
import type {Person,Product} from '@/app/platform-data';

type ProfileRow={user_id:string;avatar_name:string;display_name:string|null;region:string;bio:string;avatar_url:string|null;banner_url:string|null;skills:string[];trust_status:string};
type ProductRow={id:string;slug:string;name:string;description:string;category:string;condition:string;price_amount:number;currency:string;stock:number;membership_eligible:boolean;owner_id:string;product_images?:Array<{storage_path:string;alt_text:string;display_order:number}>};

const initials=(name:string)=>name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase();
const price=(amount:number,currency:string)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(amount/100);
const mark=(name:string)=>name.split(/\s+/).map(part=>part[0]).join('').slice(0,4).toUpperCase();
const images=(client:ReturnType<typeof publicSupabase>,row:ProductRow)=>(row.product_images??[]).sort((a,b)=>a.display_order-b.display_order).map(image=>({url:client.storage.from('product-media').getPublicUrl(image.storage_path).data.publicUrl,alt:image.alt_text||row.name}));

export async function findPublicPerson(handle:string):Promise<(Person&{userId:string;avatarUrl?:string;bannerUrl?:string})|null>{
  try{const {data,error}=await publicSupabase().from('profiles').select('user_id,avatar_name,display_name,region,bio,avatar_url,banner_url,skills,trust_status').eq('avatar_name',handle.replace(/^@/,'')).eq('is_public',true).eq('trust_status','approved').maybeSingle();if(error||!data)return null;const row=data as ProfileRow;const name=row.display_name||row.avatar_name;return{userId:row.user_id,name,handle:`@${row.avatar_name}`,initials:initials(name),region:row.region,status:'APPROVED PEOPLE',color:'#e9b63c',skills:row.skills??[],bio:row.bio||'This People member has not added a public biography yet.',projects:0,avatarUrl:row.avatar_url||undefined,bannerUrl:row.banner_url||undefined}}catch{return null}
}

export async function findPublicProduct(idOrSlug:string):Promise<(Product&{region:string;condition:string;stock:number;membershipEligible:boolean})|null>{
  if(!/^[a-z0-9-]{3,90}$/i.test(idOrSlug))return null;
  try{const client=publicSupabase();const {data,error}=await client.from('products').select('id,slug,name,description,category,condition,price_amount,currency,stock,membership_eligible,owner_id,product_images(storage_path,alt_text,display_order)').or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`).eq('status','published').eq('compliance_status','permitted').maybeSingle();if(error||!data)return null;const row=data as ProductRow;const {data:profile}=await client.from('profiles').select('avatar_name,display_name,region').eq('user_id',row.owner_id).maybeSingle();if(!profile)return null;return{id:row.id,slug:row.slug,name:row.name,description:row.description,category:row.category,condition:row.condition,stock:row.stock,membershipEligible:row.membership_eligible,checkoutEnabled:false,price:price(row.price_amount,row.currency),mark:mark(row.name),owner:profile.display_name||profile.avatar_name,ownerHandle:`@${profile.avatar_name}`,region:profile.region,images:images(client,row)}}catch{return null}
}

export async function productsForPerson(userId:string):Promise<Product[]>{
  try{const client=publicSupabase();const {data,error}=await client.from('products').select('id,slug,name,description,category,condition,price_amount,currency,stock,membership_eligible,owner_id,product_images(storage_path,alt_text,display_order)').eq('owner_id',userId).eq('status','published').eq('compliance_status','permitted').order('created_at',{ascending:false});if(error)return[];const {data:profile}=await client.from('profiles').select('avatar_name,display_name').eq('user_id',userId).maybeSingle();if(!profile)return[];return((data??[]) as ProductRow[]).map(row=>({id:row.id,slug:row.slug,name:row.name,description:row.description,category:row.category,condition:row.condition,stock:row.stock,membershipEligible:row.membership_eligible,checkoutEnabled:false,price:price(row.price_amount,row.currency),mark:mark(row.name),owner:profile.display_name||profile.avatar_name,ownerHandle:`@${profile.avatar_name}`,images:images(client,row)}))}catch{return[]}
}
