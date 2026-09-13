"use client";

import { FormEvent, useEffect, useState } from "react";
import { people, products } from "./platform-data";
import { authenticatedHeaders } from "./lib/supabase-browser";

type StockItem = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  status: "active" | "review" | "archived";
};
const initialStock: StockItem[] = products.map((product, index) => ({
  id: product.id,
  name: product.name,
  sku: `FR-${String(index + 1).padStart(4, "0")}`,
  stock: [12, 31, 8, 44][index],
  status: product.id === "cdswater" ? "review" : "active",
}));

export default function AdminDesk({
  show,
}: {
  show: (message: string) => void;
}) {
  const [tab, setTab] = useState<"People" | "Inventory">("People");
  const [stock, setStock] = useState(initialStock);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    let active = true;
    void authenticatedHeaders().then((headers) => fetch("/api/admin", { headers }))
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as {
          records: { title: string; data: Record<string, unknown> }[];
        };
      })
      .then((result) => {
        if (!active) return;
        const nextStatuses: Record<string, string> = {};
        let nextStock = [...initialStock];
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
      })
      .catch(() => undefined);
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
            <span>{people.length} records</span>
          </div>
          <div className="admin-table">
            <div className="admin-row admin-header">
              <span>People member</span>
              <span>Trust state</span>
              <span>Access role</span>
              <span>Controls</span>
            </div>
            {people.map((person, index) => {
              const status = statuses[person.handle] || person.status;
              return (
                <div className="admin-row" key={person.handle}>
                  <span>
                    <b>{person.name}</b>
                    <small>
                      {person.handle} · {person.region}
                    </small>
                  </span>
                  <span className="state">{status}</span>
                  <span>
                    {index === 0
                      ? "Platform steward"
                      : index < 3
                        ? "Project member"
                        : "Profile member"}
                  </span>
                  <span className="row-actions">
                    <button
                      onClick={() =>
                        void memberAction(person.handle, "APPROVED")
                      }
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => void memberAction(person.handle, "REVIEW")}
                    >
                      Review
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        void memberAction(person.handle, "SUSPENDED")
                      }
                    >
                      Suspend
                    </button>
                  </span>
                </div>
              );
            })}
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
                  <button onClick={() => void adjust(item, -1)}>−</button>
                  <button onClick={() => void adjust(item, 1)}>+</button>
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
