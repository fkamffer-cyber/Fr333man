import {env} from 'cloudflare:workers';

type Payload={entity:string;title:string;data?:Record<string,unknown>;status?:string};
const allowed=new Set(['profile','post','project','task','product','promotion','support','credential','consent','dispute','broadcast']);
const platform='fr333man';
function actor(req:Request){const id=req.headers.get('oai-authenticated-user-id');const email=req.headers.get('oai-authenticated-user-email');const local=new URL(req.url).hostname==='localhost';return id?{id,email:email||''}:local?{id:'local-preview-people',email:'preview@fr333man.co.za'}:null}
async function database(){return (env as unknown as {DB:D1Database}).DB}

export async function GET(req:Request){
  const db=await database();const url=new URL(req.url);const entity=url.searchParams.get('entity');
  const query=entity&&allowed.has(entity)?db.prepare('SELECT id, entity, owner_id, title, data, status, created_at, updated_at FROM records WHERE market_id = ? AND entity = ? AND status != ? ORDER BY updated_at DESC LIMIT 200').bind(platform,entity,'archived'):db.prepare('SELECT id, entity, owner_id, title, data, status, created_at, updated_at FROM records WHERE market_id = ? AND status != ? ORDER BY updated_at DESC LIMIT 200').bind(platform,'archived');
  const result=await query.all<Record<string,unknown>>();
  return Response.json({records:result.results.map(row=>({...row,data:JSON.parse(String(row.data||'{}'))}))});
}

export async function POST(req:Request){
  const user=actor(req);if(!user)return Response.json({error:'Sign in required'},{status:401});
  const body=await req.json() as Payload;if(!allowed.has(body.entity)||!body.title?.trim())return Response.json({error:'Invalid community record'},{status:400});
  const db=await database();const result=await db.prepare('INSERT INTO records (market_id,entity,owner_id,title,data,status) VALUES (?,?,?,?,?,?)').bind(platform,body.entity,user.id,body.title.trim(),JSON.stringify({...body.data,createdBy:user.email}),body.status||'active').run();
  return Response.json({ok:true,id:result.meta.last_row_id});
}

export async function PATCH(req:Request){
  const user=actor(req);if(!user)return Response.json({error:'Sign in required'},{status:401});
  const body=await req.json() as {id?:number;title?:string;data?:Record<string,unknown>;status?:string};if(!body.id)return Response.json({error:'Record id required'},{status:400});
  const db=await database();const current=await db.prepare('SELECT owner_id,data FROM records WHERE id = ? AND market_id = ?').bind(body.id,platform).first<{owner_id:string;data:string}>();if(!current)return Response.json({error:'Not found'},{status:404});if(current.owner_id!==user.id)return Response.json({error:'Not allowed'},{status:403});
  await db.prepare('UPDATE records SET title=COALESCE(?,title), data=?, status=COALESCE(?,status), updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(body.title||null,JSON.stringify({...JSON.parse(current.data||'{}'),...body.data}),body.status||null,body.id).run();
  return Response.json({ok:true});
}
