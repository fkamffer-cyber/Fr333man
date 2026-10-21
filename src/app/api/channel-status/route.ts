export async function GET(){
  return Response.json({
    channels:{
      meta:{mode:'catalog_feed',configured:Boolean(process.env.META_CATALOG_ID&&process.env.META_ACCESS_TOKEN),feed:'/api/catalog/meta'},
      ebay:{mode:'oauth_api',configured:Boolean(process.env.EBAY_CLIENT_ID&&process.env.EBAY_CLIENT_SECRET&&process.env.EBAY_RU_NAME)},
      takealot:{mode:'seller_api_key',configured:Boolean(process.env.TAKEALOT_API_KEY)},
      bobshop:{mode:'bob_sync_or_csv',configured:false},
      gumtree:{mode:'assisted_or_commercial_feed',configured:false}
    }
  },{headers:{'Cache-Control':'no-store'}})
}
