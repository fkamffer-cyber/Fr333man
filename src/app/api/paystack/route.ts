import {rejectCrossOrigin} from '@/lib/http';

const blockedProducts=new Set(['cdswater']);
const permittedProducts:Record<string,{amount:number;name:string}>={npk432:{amount:220,name:'NPK432 biological starter'},'solar-workshop':{amount:350,name:'Know Your Solar workshop'},'fido-treats':{amount:85,name:'Fido natural dog treats'}};

export async function POST(req:Request){
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  const body=await req.json() as {email?:string;amount?:number;productId?:string;productName?:string;policyAccepted?:boolean};
  const email=body.email?.trim();const productId=body.productId?.trim();
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return Response.json({error:'A valid email is required'},{status:400});
  if(!body.policyAccepted)return Response.json({error:'Accept the terms, refund and delivery policies before checkout'},{status:400});
  if(!productId||blockedProducts.has(productId))return Response.json({error:'This product needs written category approval before Paystack payment can be enabled'},{status:422});
  const product=permittedProducts[productId];if(!product)return Response.json({error:'This product has not passed payment review'},{status:422});
  const key=process.env.PAYSTACK_SECRET_KEY;
  if(!key)return Response.json({configured:false,message:'Paystack is not connected yet. Add the approved merchant secret after business verification.'});
  const origin=new URL(req.url).origin;
  const response=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({email,amount:product.amount*100,reference:`fr333man-${crypto.randomUUID()}`,callback_url:`${origin}/?view=Marketplace`,metadata:{product_id:productId,product_name:product.name}})});
  const result=await response.json();
  if(!response.ok)return Response.json({error:'Paystack could not start this checkout'},{status:502});
  return Response.json(result,{status:response.status});
}
