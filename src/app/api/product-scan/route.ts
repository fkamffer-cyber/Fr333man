import {authenticatedSupabase} from '@/lib/supabase-server';
import {rejectCrossOrigin} from '@/lib/http';

const acceptedTypes=new Set(['image/jpeg','image/png','image/webp']);
const categoryRules:Array<[string,string[]]>=[
  ['Vehicles',['car','vehicle','motorcycle','bicycle','truck']],
  ['Electronics',['phone','computer','laptop','camera','television','electronic','tablet','speaker']],
  ['Apparel',['clothing','shoe','dress','shirt','jacket','bag','watch']],
  ['Home Goods',['furniture','chair','table','sofa','appliance','cookware','lamp']],
  ['Garden & Outdoor',['garden','plant','outdoor','tool','lawn']],
  ['Sporting Goods',['sport','fitness','golf','soccer','bicycle']],
  ['Toys & Games',['toy','game','doll']],
  ['Musical Instruments',['guitar','piano','instrument','drum']],
  ['Office Supplies',['printer','office','stationery']],
  ['Business Equipment',['machine','industrial','equipment']],
];

type VisionEntity={description?:string;score?:number};
type VisionPage={url?:string;pageTitle?:string};
type VisionAnnotation={description?:string;score?:number};
type VisionResponse={
  responses?:Array<{
    error?:{message?:string};
    webDetection?:{bestGuessLabels?:VisionAnnotation[];webEntities?:VisionEntity[];pagesWithMatchingImages?:VisionPage[]};
    labelAnnotations?:VisionAnnotation[];
    textAnnotations?:VisionAnnotation[];
  }>;
};

function clean(value:unknown,max=500){return typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):''}
function titleCase(value:string){return value.toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase())}
function suggestedCategory(words:string[]){const haystack=words.join(' ').toLowerCase();return categoryRules.find(([,terms])=>terms.some(term=>haystack.includes(term)))?.[0]||'Classifieds'}

export async function POST(req:Request){
  const originError=rejectCrossOrigin(req);if(originError)return originError;
  try{
    const auth=await authenticatedSupabase(req);if(!auth)return Response.json({error:'Sign in to use assisted product scanning'},{status:401});
    const apiKey=process.env.GOOGLE_CLOUD_VISION_API_KEY;if(!apiKey)return Response.json({error:'Product scanning is not configured yet. Add GOOGLE_CLOUD_VISION_API_KEY on the server.'},{status:503});
    const form=await req.formData();const file=form.get('file');
    if(!(file instanceof File))return Response.json({error:'Choose a product photo to scan'},{status:400});
    if(!acceptedTypes.has(file.type))return Response.json({error:'Use a JPEG, PNG or WebP photo'},{status:415});
    if(file.size>8_000_000)return Response.json({error:'Photo must be smaller than 8 MB'},{status:413});
    const content=Buffer.from(await file.arrayBuffer()).toString('base64');
    const googleResponse=await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
      body:JSON.stringify({requests:[{image:{content},features:[{type:'WEB_DETECTION',maxResults:12},{type:'LABEL_DETECTION',maxResults:12},{type:'TEXT_DETECTION',maxResults:4}]}]})
    });
    const result=await googleResponse.json() as VisionResponse;
    if(!googleResponse.ok)return Response.json({error:'Google image analysis is temporarily unavailable'},{status:502});
    const first=result.responses?.[0];if(first?.error)return Response.json({error:clean(first.error.message,240)||'Google could not analyse this image'},{status:422});
    const web=first?.webDetection;const guesses=(web?.bestGuessLabels||[]).map(item=>clean(item.description,100)).filter(Boolean);
    const entities=(web?.webEntities||[]).filter(item=>(item.score||0)>=.35).map(item=>clean(item.description,100)).filter(Boolean);
    const labels=(first?.labelAnnotations||[]).filter(item=>(item.score||0)>=.65).map(item=>clean(item.description,100)).filter(Boolean);
    const words=Array.from(new Set([...guesses,...entities,...labels])).slice(0,12);
    const name=titleCase(guesses[0]||entities[0]||labels[0]||'');
    const detectedText=clean(first?.textAnnotations?.[0]?.description,350);
    const description=name?`${name}. Photo analysis suggests: ${words.slice(0,7).join(', ')}.${detectedText?` Visible text: ${detectedText}.`:''} Confirm the brand, model, condition, dimensions and included accessories before publishing.`:'';
    const references=(web?.pagesWithMatchingImages||[]).map(page=>({title:clean(page.pageTitle,160)||'Matching web page',url:clean(page.url,600)})).filter(page=>page.url.startsWith('http')).slice(0,6);
    const searchQuery=encodeURIComponent(name||words.slice(0,4).join(' '));
    return Response.json({name,description,category:suggestedCategory(words),keywords:words,detectedText,references,shoppingUrl:searchQuery?`https://www.google.com/search?tbm=shop&q=${searchQuery}`:'',notice:'Recognition suggestions require seller confirmation. Live prices are not supplied by Google Cloud Vision.'});
  }catch{return Response.json({error:'The product photo could not be analysed'},{status:500})}
}
