import {authenticatedSupabase, serviceSupabase} from '@/lib/supabase-server';
import {rejectCrossOrigin} from '@/lib/http';

const accepted=new Set(['image/jpeg','image/png','image/webp']);
const idPattern=/^[a-z0-9-]{3,90}$/i;

export async function POST(req:Request){
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  try{
    const auth=await authenticatedSupabase(req);if(!auth)return Response.json({error:'Sign in required'},{status:401});const form=await req.formData();const file=form.get('file');const productId=String(form.get('productId')||'');const alt=String(form.get('alt')||'').trim().slice(0,180);
    if(!(file instanceof File))return Response.json({error:'Product image required'},{status:400});if(!idPattern.test(productId))return Response.json({error:'Valid product id required'},{status:400});if(file.size>8_000_000)return Response.json({error:'Image must be under 8 MB'},{status:413});if(!accepted.has(file.type))return Response.json({error:'Use a JPEG, PNG or WebP image'},{status:415});
    const admin=serviceSupabase();const {data:product,error:productError}=await admin.from('products').select('id').eq('owner_id',auth.user.id).or(`id.eq.${productId},slug.eq.${productId}`).maybeSingle();if(productError)throw productError;if(!product)return Response.json({error:'Product not found'},{status:404});const {count,error:countError}=await admin.from('product_images').select('id',{count:'exact',head:true}).eq('product_id',product.id);if(countError)throw countError;if((count??0)>=8)return Response.json({error:'A product can have up to 8 images'},{status:409});
    const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=`${auth.user.id}/products/${product.id}/${crypto.randomUUID()}.${extension}`;
    const {error:uploadError}=await auth.client.storage.from('product-media').upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;
    const displayOrder=count??0;const {data:image,error:imageError}=await admin.from('product_images').insert({product_id:product.id,owner_id:auth.user.id,storage_path:path,alt_text:alt||'Product image',display_order:displayOrder}).select('id,storage_path,alt_text,display_order').single();if(imageError){await auth.client.storage.from('product-media').remove([path]);throw imageError}const {data:publicFile}=auth.client.storage.from('product-media').getPublicUrl(path);
    return Response.json({ok:true,image:{id:image.id,url:publicFile.publicUrl,alt:image.alt_text,displayOrder:image.display_order}},{status:201});
  }catch{return Response.json({error:'Product image upload is temporarily unavailable'},{status:503})}
}
