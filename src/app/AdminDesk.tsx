"use client";

import { FormEvent, useEffect, useState } from "react";
import { authenticatedHeaders } from "./lib/supabase-browser";

type StockItem = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  status: "active" | "review" | "archived";
};
type MemberRecord = {user_id:string;avatar_name:string;display_name:string|null;region:string;member_type:string;trust_status:string;platform_role:string;witness_handle:string|null;witness_selfie_ready:boolean;witness_selfie_url:string|null;onboarding_status:string|null;submitted_at:string|null;verified_at:string|null};
const initialStock: StockItem[] = [];

export default function AdminDesk({
  show,
}: {
  show: (message: string) => void;
}) {
  const [tab, setTab] = useState<"People" | "Inventory">("People");
  const [stock, setStock] = useState(initialStock);
  const [members,setMembers]=useState<MemberRecord[]>([]);
  const [adminNotice,setAdminNotice]=useState("");
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    let active = true;
    void authenticatedHeaders().then((headers) => fetch("/api/admin", { headers }))
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as {
          records: { title: string; data: Record<string, unknown> }[];
          products?: {id:string;name:string;sku:string|null;stock:number;compliance_status:string;status:string}[];
          members?: MemberRecord[];
        };
      })
      .then((result) => {
        if (!active) return;
        const nextStatuses: Record<string, string> = {};
        let nextStock:StockItem[] = result.products?.length ? result.products.map((item,index)=>({id:item.id,name:item.name,sku:item.sku||`SHOP-${String(index+1).padStart(4,"0")}`,stock:item.stock,status:item.compliance_status==='pending_review'?"review":item.status==='archived'?"archived":"active"})) : [...initialStock];
        for (const record of result.records) {
          const data = record.data;
          const action = String(data.action || "");
          if (action === "member-status")
            nextStatuses[record.title] = String(data.status || "REVIEW");
          if (action === "stock-adjustment")
            nextStock = nextStock.map((item) =>
              item.id === data.productId
                ? { ...item, stock: Number(data.stock) }
                : item,
            );
          if (
            action === "inventory-create" &&
            !nextStock.some((item) => item.id === data.id)
          )
            nextStock = [data as unknown as StockItem, ...nextStock];
          if (action === "inventory-archive")
            nextStock = nextStock.filter((item) => item.id !== data.productId);
        }
        setStatuses(nextStatuses);
        setStock(nextStock);
        setMembers(result.members??[]);
      })
      .catch(() => setAdminNotice("Connect Supabase and sign in as a steward to load real People records."));
    return () => {
      active = false;
    };
  }, []);
  const save = async (
    action: string,
    title: string,
    data: Record<string, unknown>,
  ) => {
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) },
      body: JSON.stringify({ action, title, data }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      show(result.error || "Administration change could not be saved");
      return false;
    }
    show(`${title} saved to the audit trail`);
    return true;
  };
  const memberAction = async (handle: string, next: string) => {
    if (await save("member-status", handle, { status: next })) {
      setStatuses((value) => ({ ...value, [handle]: next }));
      setMembers(current=>current.map(member=>`@${member.avatar_name}`===handle?{...member,trust_status:next==="APPROVED"?"approved":next==="SUSPENDED"?"suspended":"pending_review",...(next==="APPROVED"?{onboarding_status:"approved",verified_at:new Date().toISOString()}: {})}:member));
    }
  };
  const adjust = async (item: StockItem, delta: number) => {
    const next = Math.max(0, item.stock + delta);
    if (
      await save("stock-adjustment", item.name, {
        productId: item.id,
        stock: next,
        delta,
      })
    ) {
      setStock((items) =>
        items.map((row) =>
          row.id === item.id ? { ...row, stock: next } : row,
        ),
      );
    }
  };
  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name"));
    const item: StockItem = {
      id: crypto.randomUUID(),
      name,
      sku: String(form.get("sku")),
      stock: Number(form.get("stock")),
      status: "active",
    };
    void save("inventory-create", name, item).then((ok) => {
      if (ok) {
        setStock((value) => [item, ...value]);
        setAdding(false);
      }
    });
  };
  const reviewProduct=async(item:StockItem,status:"PERMITTED"|"BLOCKED")=>{if(await save("product-status",item.name,{productId:item.id,status})){setStock(current=>status==="PERMITTED"?current.map(row=>row.id===item.id?{...row,status:"active"}:row):current.filter(row=>row.id!==item.id))}};
  return (
    <section className="operations-shell">
      <header className="operations-hero">
        <div>
          <p>STEWARD OPERATIONS</p>
          <h1>Administration</h1>
          <span>
            Member decisions and stock changes are attributed and written to an
            audit trail.
          </span>
        </div>
        <div className="role-key">
          <b>Current role</b>
          <span>Platform steward</span>
        </div>
      </header>
      <div className="admin-tabs">
        {(["People", "Inventory"] as const).map((item) => (
          <button
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "People" ? (
        <article className="operations-card">
          <div className="panel-head">
            <div>
              <p>MEMBER MANAGEMENT</p>
              <h2>People and permissions</h2>
            </div>
            <span>{members.length} real records</span>
          </div>
          <div className="admin-table">
            <div className="admin-row admin-header">
              <span>People member</span>
              <span>Trust state</span>
              <span>Access role</span>
              <span>Controls</span>
            </div>
            {members.length?members.map((person) => {
              const handle=`@${person.avatar_name}`;const status = statuses[handle] || person.trust_status.replaceAll("_"," ").toUpperCase();
              return (
                <div className="admin-row" key={person.user_id}>
                  <span>
                    <b>{person.display_name||person.avatar_name}</b>
                    <small>
                      {handle} · {person.region}
                    </small>
                    <small>{person.witness_selfie_ready?`Joint selfie ready · witness ${person.witness_handle}`:"Joint selfie missing"}</small>
                  </span>
                  <span className="state">{status}</span>
                  <span>{person.platform_role.replaceAll("_"," ")}</span>
                  <span className="row-actions">
                    {person.witness_selfie_url&&<a href={person.witness_selfie_url} target="_blank" rel="noreferrer">Review selfie ↗</a>}
                    <button
                      disabled={!person.witness_selfie_ready||person.trust_status==="approved"}
                      onClick={() =>
                        void memberAction(handle, "APPROVED")
                      }
                    >
                      Verify &amp; welcome
                    </button>
                    <button
                      onClick={() => void memberAction(handle, "REVIEW")}
                    >
                      Review
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        void memberAction(handle, "SUSPENDED")
                      }
                    >
                      Suspend
                    </button>
                  </span>
                </div>
              );
            }):<div className="empty-work"><b>No People records loaded.</b><span>{adminNotice||"New onboarding submissions will appear here for joint-selfie review."}</span></div>}
          </div>
        </article>
      ) : (
        <article className="operations-card">
          <div className="panel-head">
            <div>
              <p>STOCK &amp; PRODUCTS</p>
              <h2>Inventory control</h2>
            </div>
            <button
              className="primary"
              onClick={() => setAdding((value) => !value)}
            >
              {adding ? "Close form" : "+ Add product"}
            </button>
          </div>
          {adding && (
            <form className="stock-form" onSubmit={add}>
              <label>
                Product name
                <input name="name" required />
              </label>
              <label>
                SKU
                <input name="sku" required placeholder="FS-0068" />
              </label>
              <label>
                Opening stock
                <input
                  name="stock"
                  required
                  type="number"
                  min="0"
                  defaultValue="1"
                />
              </label>
              <button className="primary">Save product</button>
            </form>
          )}
          <div className="admin-table">
            <div className="stock-row admin-header">
              <span>Product</span>
              <span>SKU</span>
              <span>Compliance</span>
              <span>Stock</span>
              <span>Controls</span>
            </div>
            {stock.map((item) => (
              <div className="stock-row" key={item.id}>
                <b>{item.name}</b>
                <span>{item.sku}</span>
                <span
                  className={`state ${item.status === "review" ? "pending" : ""}`}
                >
                  {item.status === "review" ? "Manual review" : "Permitted"}
                </span>
                <strong className={item.stock < 10 ? "low-stock" : ""}>
                  {item.stock}
                </strong>
                <span className="row-actions">
                  {item.status === "review" ? <><button onClick={() => void reviewProduct(item,"PERMITTED")}>Approve</button><button className="danger" onClick={() => void reviewProduct(item,"BLOCKED")}>Block</button></> : <><button onClick={() => void adjust(item, -1)}>−</button><button onClick={() => void adjust(item, 1)}>+</button></>}
                  <button
                    className="danger"
                    onClick={() =>
                      void save("inventory-archive", item.name, {
                        productId: item.id,
                        status: "archived",
                      }).then(
                        (ok) =>
                          ok &&
                          setStock((rows) =>
                            rows.filter((row) => row.id !== item.id),
                          ),
                      )
                    }
                  >
                    Archive
                  </button>
                </span>
              </div>
            ))}
          </div>
        </article>
      )}
      <p className="admin-note">
        Only authenticated platform stewards can write administration decisions.
        Ethics committee decisions should record both parties, the claim,
        evidence, proposed outcomes and the final reasoned resolution.
      </p>
    </section>
  );
}
