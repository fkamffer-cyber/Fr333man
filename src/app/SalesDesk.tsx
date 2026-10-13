"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { products, type Product } from "./platform-data";
import { authenticatedHeaders } from "./lib/supabase-browser";

const channels = [
  { name: "Facebook Marketplace", short: "Facebook", url: "https://www.facebook.com/marketplace/create/item" },
  { name: "Gumtree South Africa", short: "Gumtree", url: "https://www.gumtree.co.za/post.html" },
  { name: "Bob Shop", short: "Bob Shop", url: "https://www.bobshop.co.za/sell" },
  { name: "eBay", short: "eBay", url: "https://www.ebay.com/sl/sell" },
];

type SalesItem = Product & {
  sku: string;
  condition: string;
  quantity: string;
  location: string;
  delivery: string;
  stage: "Draft" | "Published" | "Enquiry" | "Sold";
};

const inventory: SalesItem[] = products.map((product, index) => ({
  ...product,
  sku: `FS-${String(index + 1).padStart(4, "0")}`,
  condition: "Confirm before publishing",
  quantity: "Confirm stock",
  location: product.ownerHandle === "@fr333man" ? "Randburg" : "Seller profile",
  delivery: "Collection or delivery to be confirmed",
  stage: index === 0 ? "Draft" : "Published",
}));

function listingText(item: SalesItem) {
  return `${item.name}\n${item.price}\n\n${item.description}\n\nCondition: ${item.condition}\nLocation: ${item.location}\nDelivery: ${item.delivery}\nReference: ${item.sku}`;
}

export default function SalesDesk({ show }: { show: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = useState(false);
  const [stage, setStage] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SalesItem | null>(inventory[0] || null);
  const [ownedInventory, setOwnedInventory] = useState<SalesItem[]>(inventory);
  const stages = ["All", "Draft", "Published", "Enquiry", "Sold"];

  useEffect(() => { const controller=new AbortController(); void authenticatedHeaders().then(headers=>fetch("/api/marketplace?mine=true",{headers,signal:controller.signal})).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as {products?:Array<Product&{status?:string;stock?:number;condition?:string;region?:string}>};if(!data.products?.length)return;const mapped=data.products.map((product,index):SalesItem=>({...product,sku:`SHOP-${String(index+1).padStart(4,"0")}`,condition:product.condition||"Confirm before publishing",quantity:`${product.stock??0} available`,location:product.region||"Seller profile",delivery:"Collection or delivery to be confirmed",stage:product.status==="published"?"Published":product.status==="sold_out"?"Sold":"Draft"}));setOwnedInventory(mapped);setSelected(mapped[0]||null)}).catch(()=>undefined);return()=>controller.abort(); }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ownedInventory.filter(
      (item) =>
        (stage === "All" || item.stage === stage) &&
        (!needle || [item.name, item.sku, item.category, item.owner].some((value) => value.toLowerCase().includes(needle))),
    );
  }, [ownedInventory, query, stage]);

  const upload = async (file?: File) => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/upload", { method: "POST", headers: await authenticatedHeaders(), body: form });
      if (!response.ok) throw new Error();
      setUploaded(true);
      show("Sales workbook attached. Its records are ready for reconciliation.");
    } catch {
      show("Workbook upload failed; the original file stayed on your device");
    }
  };
  const updateProduct=async(item:SalesItem,changes:Record<string,unknown>)=>{try{const response=await fetch("/api/marketplace",{method:"PATCH",headers:{"Content-Type":"application/json",...(await authenticatedHeaders())},body:JSON.stringify({id:item.id,...changes})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"Product update failed");if(changes.status==="archived"){setOwnedInventory(current=>current.filter(row=>row.id!==item.id));setSelected(current=>current?.id===item.id?null:current)}else{setOwnedInventory(current=>current.map(row=>row.id===item.id?{...row,stock:typeof changes.stock==="number"?changes.stock:row.stock,quantity:typeof changes.stock==="number"?`${changes.stock} available`:row.quantity,stage:changes.status==="pending_review"?"Draft":row.stage}:row));setSelected(current=>current?.id===item.id?{...current,stock:typeof changes.stock==="number"?changes.stock:current.stock,quantity:typeof changes.stock==="number"?`${changes.stock} available`:current.quantity}:current)}show(`${item.name} updated`);return true}catch(error){show(error instanceof Error?error.message:"Product update failed");return false}};
  const uploadProductImage=async(file?:File)=>{if(!file||!selected)return;const form=new FormData();form.set("file",file);form.set("productId",selected.id);form.set("alt",selected.name);try{const response=await fetch("/api/product-upload",{method:"POST",headers:await authenticatedHeaders(),body:form});const result=await response.json() as {error?:string;image?:{url:string;alt:string}};if(!response.ok||!result.image)throw new Error(result.error||"Image upload failed");const image={url:result.image.url,alt:result.image.alt};setOwnedInventory(current=>current.map(row=>row.id===selected.id?{...row,images:[...(row.images||[]),image]}:row));setSelected(current=>current?.id===selected.id?{...current,images:[...(current.images||[]),image]}:current);if(imageInput.current)imageInput.current.value="";show(`Image added to ${selected.name}`)}catch(error){show(error instanceof Error?error.message:"Image upload failed")}};

  const copyAdvert = async (item: SalesItem) => {
    await navigator.clipboard.writeText(listingText(item));
    show(`${item.sku} advert copied`);
  };

  const openChannel = (item: SalesItem, channel: (typeof channels)[number]) => {
    const opened = window.open(channel.url, "_blank", "noopener,noreferrer");
    void navigator.clipboard.writeText(listingText(item))
      .then(() => show(`${item.sku} advert copied. Paste it into ${channel.name}.`))
      .catch(() => show(`${channel.name} opened for ${item.sku}`));
    if (!opened) show(`Allow pop-ups to open ${channel.name}`);
  };

  const shareItem = async (item: SalesItem) => {
    const url = `${window.location.origin}/products/${encodeURIComponent(item.id)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text: listingText(item), url });
        show(`${item.sku} shared`);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(`${listingText(item)}\n${url}`);
    show(`${item.sku} listing and public link copied`);
  };

  const askingValue = ownedInventory.reduce((total, item) => total + Number(item.price.replace(/[^0-9.]/g, "")), 0);

  return (
    <section className="operations-shell sales-desk">
      <header className="operations-hero sales-heading">
        <div><p>MY SALES · RANDBURG</p><h1>Explore inventory</h1><span>Open any item, check its details and prepare its advert for a sales platform.</span></div>
        <div className="hero-actions">
          <input ref={input} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void upload(event.target.files?.[0])} />
          <button onClick={() => input.current?.click()}>{uploaded ? "Workbook attached ✓" : "Attach master workbook"}</button>
          <button className="primary" onClick={() => show("Add products from Administration")}>+ Add inventory</button>
        </div>
      </header>

      <div className="metric-grid sales-metrics">
        <article><small>VISIBLE ITEMS</small><b>{ownedInventory.length}</b><span>Platform records</span></article>
        <article><small>ASKING VALUE</small><b>R{askingValue.toLocaleString("en-ZA")}</b><span>Before offers and fees</span></article>
        <article><small>PUBLISHED</small><b>{ownedInventory.filter((item) => item.stage === "Published").length}</b><span>Available to promote</span></article>
        <article><small>MASTER WORKBOOK</small><b>67</b><span>Rows to reconcile after upload</span></article>
      </div>

      <div className="inventory-toolbar operations-card">
        <label><span>Search inventory</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, FS number, category or seller" /></label>
        <div className="stage-filter" aria-label="Inventory stage">
          {stages.map((name) => <button className={stage === name ? "active" : ""} onClick={() => setStage(name)} key={name}>{name}</button>)}
        </div>
      </div>

      <div className="inventory-workspace">
        <div className="inventory-list" aria-label="Sales inventory">
          {visible.map((item) => (
            <button className={`inventory-item ${selected?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelected(item)}>
              <i>{item.mark}</i>
              <span><small>{item.sku} · {item.category}</small><strong>{item.name}</strong><em>{item.owner} · {item.location}</em></span>
              <span className="inventory-price"><b>{item.price}</b><small className={`sales-stage ${item.stage.toLowerCase()}`}>{item.stage}</small></span>
            </button>
          ))}
          {!visible.length && <div className="empty-work"><b>No matching inventory.</b><span>Try another search or stage.</span></div>}
        </div>

        {selected && (
          <article className="inventory-detail operations-card">
            <header>{selected.images?.[0]?.url?<img className="inventory-photo" src={selected.images[0].url} alt={selected.images[0].alt}/>:<div className="inventory-mark">{selected.mark}</div>}<span><small>{selected.sku} · {selected.category}</small><h2>{selected.name}</h2><b>{selected.price}</b></span></header>
            <p>{selected.description}</p>
            <dl>
              <div><dt>Seller</dt><dd>{selected.owner}</dd></div><div><dt>Condition</dt><dd>{selected.condition}</dd></div>
              <div><dt>Stock</dt><dd>{selected.quantity}</dd></div><div><dt>Location</dt><dd>{selected.location}</dd></div>
              <div><dt>Fulfilment</dt><dd>{selected.delivery}</dd></div><div><dt>Membership</dt><dd>Catalogue eligibility reviewed separately</dd></div>
            </dl>
            <div className="detail-actions">
              <a href={`/products/${selected.id}`} target="_blank" rel="noreferrer">Open public listing ↗</a>
              <button onClick={() => void copyAdvert(selected)}>Copy advert</button>
              <button className="primary" onClick={() => void shareItem(selected)}>Share item</button>
            </div>
            <section className="publish-panel"><p>MANAGE PRODUCT</p><span>Changes apply only to your product. Re-publishing returns it to steward review.</span><input ref={imageInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>void uploadProductImage(event.target.files?.[0])}/><div><button onClick={()=>imageInput.current?.click()}>Add image</button><button onClick={()=>void updateProduct(selected,{stock:Math.max(0,(selected.stock??0)-1)})}>− Stock</button><button onClick={()=>void updateProduct(selected,{stock:(selected.stock??0)+1})}>+ Stock</button><button onClick={()=>void updateProduct(selected,{status:"pending_review"})}>Submit review</button><button onClick={()=>void updateProduct(selected,{status:"paused"})}>Pause</button><button onClick={()=>void updateProduct(selected,{status:"archived"})}>Archive</button></div></section>
            <section className="publish-panel"><p>PUBLISH THIS ITEM</p><span>The advert is copied first; paste it into the seller form that opens.</span><div>{channels.map((channel) => <button key={channel.name} onClick={() => openChannel(selected, channel)}>{channel.short} ↗</button>)}</div></section>
            <small className="sales-disclaimer">Review price, condition, stock and delivery before publishing. Final publication remains under the seller’s approval.</small>
          </article>
        )}
      </div>
    </section>
  );
}
