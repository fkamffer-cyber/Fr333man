import {env} from 'cloudflare:workers';

const accepted=new Set(['application/pdf','image/jpeg','image/png','image/webp']);
function owner(req:Request){const id=req.headers.get('oai-authenticated-user-id');const local=new URL(req.url).hostname==='localhost';return id||(local?'local-preview-people':'')}

export async function POST(req:Request){
  const userId=owner(req);if(!userId)return Response.json({error:'Sign in required'},{status:401});
  const form=await req.formData();const file=form.get('file');if(!(file instanceof File))return Response.json({error:'File required'},{status:400});
  if(file.size>8_000_000)return Response.json({error:'File must be under 8 MB'},{status:413});
  if(!accepted.has(file.type))return Response.json({error:'Use a PDF, JPEG, PNG or WebP file'},{status:415});
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'-').slice(-120);const key=`people/${userId}/credentials/${crypto.randomUUID()}-${safeName}`;
  await (env as unknown as {FILES:R2Bucket}).FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type},customMetadata:{owner:userId}});
  return Response.json({ok:true,key,name:file.name});
}
