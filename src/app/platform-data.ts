export type Person={name:string;handle:string;initials:string;region:string;status:string;color:string;skills:string[];bio:string;projects:number};
export type Project={id:string;title:string;category:string;region:string;status:string;summary:string;progress:number;openTasks:number;people:number;tasks:string[];accent:string;icon:string};
export type Product={id:string;slug?:string;name:string;owner:string;ownerHandle:string;region?:string;category:string;subcategory?:string;description:string;price:string;mark:string;condition?:string;stock?:number;sku?:string;brand?:string;model?:string;gtin?:string;tags?:string[];availability?:string;listingLocation?:string;deliveryOptions?:string[];membershipEligible?:boolean;checkoutEnabled?:boolean;status?:string;complianceStatus?:string;publicationStatus?:string;images?:Array<{url:string;alt:string}>;shop?:{name:string;slug:string}};
export const people:Person[]=[];
export const projects:Project[]=[];
export const products:Product[]=[];
