import {authenticatedSupabase, serviceSupabase} from '@/lib/supabase-server';
import {rejectCrossOrigin} from '@/lib/http';

const accepted=new Set(['image/jpeg','image/png','image/webp']);
const idPattern=/^[a-z0-9-]{3,90}$/i;

export async function POST(req:Request){
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  try{
    const auth=await authenticatedSupabase(req);if(!auth)return Response.json({error:'Sign in required'},{status:401});const form=await req.formData();const file=form.get('file');const productId=String(form.get('productId')||'');const alt=String(form.get('alt')||'').trim().slice(0,180);
    if(!(file instanceof File))return Response.json({error:'Product image required'},{status:400});if(!idPattern.test(productId))return Response.json({error:'Valid product id required'},{status:400});if(file.size>8_000_000)return Response.json({error:'Image must be under 8 MB'},{status:413});if(!accepted.has(file.type))return Response.json({error:'Use a JPEG, PNG or WebP image'},{status:415});
    const admin=serviceSupabase();const {data:product,error:productError}=await admin.from('products').select('id').eq('owner_id',auth.user.id).or(`id.eq.${productId},slug.eq.${productId}`).maybeSingle();if(productError)throw productError;if(!product)return Response.json({error:'Product not found'},{status:404});
    const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=`${auth.user.id}/products/${product.id}/${crypto.randomUUID()}.${extension}`;
    const {error:uploadError}=await auth.client.storage.from('product-media').upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;
    const {error:imageError}=await admin.from('product_images').insert({product_id:product.id,owner_id:auth.user.id,storage_path:path,alt_text:alt});if(imageError){await auth.client.storage.from('product-media').remove([path]);throw imageError}
    return Response.json({ok:true,path});
  }catch{return Response.json({error:'Product image upload is temporarily unavailable'},{status:503})}
}
