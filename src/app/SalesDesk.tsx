"use client";

import { useMemo, useRef, useState } from "react";
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
  const [uploaded, setUploaded] = useState(false);
  const [stage, setStage] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SalesItem | null>(inventory[0] || null);
  const stages = ["All", "Draft", "Published", "Enquiry", "Sold"];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inventory.filter(
      (item) =>
        (stage === "All" || item.stage === stage) &&
        (!needle || [item.name, item.sku, item.category, item.owner].some((value) => value.toLowerCase().includes(needle))),
    );
  }, [query, stage]);

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

  const askingValue = inventory.reduce((total, item) => total + Number(item.price.replace(/[^0-9.]/g, "")), 0);

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
        <article><small>VISIBLE ITEMS</small><b>{inventory.length}</b><span>Platform records</span></article>
        <article><small>ASKING VALUE</small><b>R{askingValue.toLocaleString("en-ZA")}</b><span>Before offers and fees</span></article>
        <article><small>PUBLISHED</small><b>{inventory.filter((item) => item.stage === "Published").length}</b><span>Available to promote</span></article>
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
            <header><div className="inventory-mark">{selected.mark}</div><span><small>{selected.sku} · {selected.category}</small><h2>{selected.name}</h2><b>{selected.price}</b></span></header>
            <p>{selected.description}</p>
            <dl>
              <div><dt>Seller</dt><dd>{selected.owner}</dd></div><div><dt>Condition</dt><dd>{selected.condition}</dd></div>
              <div><dt>Stock</dt><dd>{selected.quantity}</dd></div><div><dt>Location</dt><dd>{selected.location}</dd></div>
              <div><dt>Fulfilment</dt><dd>{selected.delivery}</dd></div><div><dt>Gift points</dt><dd>{selected.points} after eligible settlement</dd></div>
            </dl>
            <div className="detail-actions">
              <a href={`/products/${selected.id}`} target="_blank" rel="noreferrer">Open public listing ↗</a>
              <button onClick={() => void copyAdvert(selected)}>Copy advert</button>
              <button className="primary" onClick={() => void shareItem(selected)}>Share item</button>
            </div>
            <section className="publish-panel"><p>PUBLISH THIS ITEM</p><span>The advert is copied first; paste it into the seller form that opens.</span><div>{channels.map((channel) => <button key={channel.name} onClick={() => openChannel(selected, channel)}>{channel.short} ↗</button>)}</div></section>
            <small className="sales-disclaimer">Review price, condition, stock and delivery before publishing. Final publication remains under the seller’s approval.</small>
          </article>
        )}
      </div>
    </section>
  );
}
