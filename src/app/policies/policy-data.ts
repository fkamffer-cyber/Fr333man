export type Policy={title:string;eyebrow:string;summary:string;sections:{heading:string;body:string}[]};

export const policies:Record<string,Policy>={
  terms:{title:'Platform and marketplace terms',eyebrow:'TERMS OF USE',summary:'Rules for profiles, projects, products, payments and non-cash support points.',sections:[
    {heading:'People and accounts',body:'Each account belongs to one natural person. Profile access can begin before activation, but trust features require the stated identity, liveness and people-witness checks. Members must keep access credentials secure and provide accurate information.'},
    {heading:'Marketplace responsibilities',body:'Each seller is the merchant responsible for the legality, description, price, quality, delivery, returns, taxes and customer support for their own product. FR333MAN does not receive or settle money for one seller on behalf of another unless a separately licensed and approved structure is in place.'},
    {heading:'Support points',body:'Support points are revocable, non-cash platform benefits. They are not money, deposits, securities or investments; cannot be purchased, withdrawn or promised a cash value; and are allocated only after an eligible settled activity. Abuse, reversals and refunds may reverse related points.'},
    {heading:'Opening fee',body:'The stated USD 10 account-opening fee becomes due on day 14 only if the account remains open. A member may cancel within the first 14 days before the fee becomes due. Currency conversion, taxes and refund treatment must be shown at checkout.'},
  ]},
  privacy:{title:'Privacy and POPIA notice',eyebrow:'PERSONAL INFORMATION',summary:'How profile, identity, biometric and document-vault information must be handled.',sections:[
    {heading:'Purpose and minimisation',body:'FR333MAN collects only information needed for account operation, safety, identity verification, payments, fulfilment and lawful credential requests. Public profile information is separated from protected identity documents and biometric templates.'},
    {heading:'Biometrics and credentials',body:'Biometric and identity information requires specific, informed consent or another lawful basis. It must be encrypted, access-controlled, auditable, retained only as long as necessary and capable of deletion where legally permitted. A QR profile never reveals stored identity documents.'},
    {heading:'Your rights',body:'People may request access, correction, deletion where applicable, objection to processing, restriction, portability where available, and information about recipients. Complaints may be made to the Information Regulator of South Africa.'},
    {heading:'Service providers and regions',body:'Payment, hosting and verification providers may process limited data under contracts and appropriate safeguards. Cross-border transfers require a lawful mechanism and an assessment of the receiving jurisdiction.'},
  ]},
  refunds:{title:'Refunds, returns and chargebacks',eyebrow:'CUSTOMER PROTECTION',summary:'Clear steps for cancellations, defective goods, returns and payment disputes.',sections:[
    {heading:'Before purchase',body:'The seller must state the item condition, total price, delivery charge, fulfilment time, return eligibility and any safety or use restrictions before payment.'},
    {heading:'Returns and refunds',body:'The responsible seller must provide remedies required by applicable consumer law. For change-of-mind or direct-marketing cooling-off rights, the applicable statutory period and return costs must be shown. Defective, unsafe or misdescribed goods must be handled under the Consumer Protection Act and other applicable law.'},
    {heading:'Refund timing',body:'Approved refunds are returned through the original payment method where possible. Related support points are reversed. Processing times depend on the seller, Paystack and the customer bank and must be communicated to the customer.'},
    {heading:'Chargeback evidence',body:'Sellers must retain receipts, invoices, delivery proof, product descriptions and buyer correspondence. Paystack disputes require urgent attention; the operations inbox must alert the seller and steward immediately.'},
  ]},
  delivery:{title:'Delivery and fulfilment policy',eyebrow:'ORDERS',summary:'Responsibilities for collection, courier delivery, digital delivery and proof of fulfilment.',sections:[
    {heading:'Seller disclosure',body:'Each listing must identify the responsible seller and state available regions, collection location at an appropriate level, dispatch estimate, delivery method, fee and tracking availability.'},
    {heading:'Collection and delivery',body:'Exact private addresses are disclosed only after payment and appropriate verification. Sellers must use safe collection practices and retain signed collection or courier proof.'},
    {heading:'Digital products',body:'Digital products must state access duration, format, device requirements and delivery method. Links and files must be delivered only to the verified purchaser.'},
    {heading:'Delays and loss',body:'The seller must notify the buyer promptly of delay, loss or inability to fulfil, and offer the remedy required by the disclosed terms and applicable consumer law.'},
  ]},
  'acceptable-use':{title:'Marketplace and acceptable-use rules',eyebrow:'PAYSTACK READINESS',summary:'Products and conduct that require rejection, specialist review or provider approval.',sections:[
    {heading:'Prohibited activity',body:'No illegal, deceptive, counterfeit, unsafe or rights-infringing goods; controlled substances; identity documents; weapons; unlicensed financial services; payment aggregation; or content that exploits, threatens or unlawfully discriminates against people.'},
    {heading:'Regulated or restricted categories',body:'Chemicals, health claims, supplements, agricultural inputs, age-restricted items, financial products and other regulated categories remain unpublished or payment-disabled until the seller provides required licences, substantiation and written provider approval where needed.'},
    {heading:'Accurate listings',body:'Listings must use accurate titles, descriptions, condition, images, seller identity, price, stock and delivery information. Unsupported performance, medical, ownership or scarcity claims are not permitted.'},
    {heading:'Enforcement',body:'Stewards may pause listings, withhold points, preserve evidence and suspend access while a review is completed. Ethics committee processes do not replace a person’s statutory, regulatory or court remedies.'},
  ]},
  contact:{title:'Merchant and customer support',eyebrow:'CONTACT & DISCLOSURE',summary:'The business details required before live payment acceptance.',sections:[
    {heading:'Responsible merchant',body:'Every product page must name the selling person or registered business that is the merchant of record. The platform must not obscure who is responsible for the goods or service.'},
    {heading:'Required contact details',body:'Before live Paystack checkout, publish the legal business name, registration details if applicable, physical service address, support email and telephone number. These details have not yet been supplied and remain a launch blocker.'},
    {heading:'Customer support',body:'Order, refund and delivery enquiries must be linked to the relevant product and seller. Payment acceptance, address disclosure and final price decisions require human approval.'},
    {heading:'Legal notice',body:'These pages are an operational compliance draft, not legal or tax advice. South African counsel and Paystack should review the final merchant model, product categories, biometric processing and cross-border operation before launch.'},
  ]},
};
