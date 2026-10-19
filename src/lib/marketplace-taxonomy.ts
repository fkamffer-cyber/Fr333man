export const marketplaceCategories=[
  'Vehicles','Property Rentals','Apparel','Classifieds','Electronics','Entertainment','Family','Free Stuff',
  'Garden & Outdoor','Hobbies','Home Goods','Home Improvement','Home Sales','Musical Instruments','Office Supplies',
  'Pet Supplies','Sporting Goods','Toys & Games','Business Equipment','Services','Digital Products'
] as const;

export type MarketplaceCategory=(typeof marketplaceCategories)[number];

export const salesChannels=[
  {id:'facebook',name:'Facebook Marketplace',short:'Facebook',url:'https://www.facebook.com/marketplace/create/item',mode:'catalog_or_assisted'},
  {id:'gumtree',name:'Gumtree South Africa',short:'Gumtree',url:'https://www.gumtree.co.za/post.html',mode:'assisted'},
  {id:'ebay',name:'eBay',short:'eBay',url:'https://www.ebay.com/sl/sell',mode:'api'},
  {id:'bobshop',name:'Bob Shop',short:'Bob Shop',url:'https://www.bobshop.co.za/sell',mode:'feed_or_assisted'},
  {id:'takealot',name:'Takealot Marketplace',short:'Takealot',url:'https://seller.takealot.com/',mode:'api'}
] as const;

export type SalesChannelId=(typeof salesChannels)[number]['id'];
