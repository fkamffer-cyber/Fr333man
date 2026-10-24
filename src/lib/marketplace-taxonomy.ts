export const marketplaceCategoryGroups=[
  {name:'Home & Garden',categories:['Tools','Furniture','Household','Garden','Appliances']},
  {name:'Entertainment',categories:['Video Games','Books, Movies & Music']},
  {name:'Clothing & Accessories',categories:['Bags & Luggage',"Women's clothing & shoes","Men's clothing & shoes",'Jewelry & Accessories']},
  {name:'Family',categories:['Health & beauty','Pet Supplies','Baby & kids','Toys & Games']},
  {name:'Electronics',categories:['Electronics & computers','Mobile phones']},
  {name:'Hobbies',categories:['Bicycles','Arts & Crafts','Sports & Outdoors','Auto parts','Musical Instruments','Antiques & Collectibles']},
  {name:'Classifieds',categories:['Garage Sale','Miscellaneous']},
  {name:'Vehicles',categories:['Vehicles']}
] as const;

export const marketplaceCategories=marketplaceCategoryGroups.flatMap(group=>group.categories);
export type MarketplaceCategory=(typeof marketplaceCategories)[number];

export const salesChannels=[
  {id:'facebook',name:'Facebook Marketplace',short:'Facebook',url:'https://www.facebook.com/marketplace/create/item',mode:'catalog_or_assisted'},
  {id:'gumtree',name:'Gumtree South Africa',short:'Gumtree',url:'https://www.gumtree.co.za/post.html',mode:'assisted'},
  {id:'ebay',name:'eBay',short:'eBay',url:'https://www.ebay.com/sl/sell',mode:'api'},
  {id:'bobshop',name:'Bob Shop',short:'Bob Shop',url:'https://www.bobshop.co.za/sell',mode:'feed_or_assisted'},
  {id:'takealot',name:'Takealot Marketplace',short:'Takealot',url:'https://seller.takealot.com/',mode:'api'}
] as const;

export type SalesChannelId=(typeof salesChannels)[number]['id'];
