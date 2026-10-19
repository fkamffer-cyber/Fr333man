"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- policy routes intentionally use hard navigation */

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  people,
  products,
  projects,
  type Person,
  type Product,
  type Project,
} from "./platform-data";
import SalesDesk from "./SalesDesk";
import AdminDesk from "./AdminDesk";
import InviteDesk from "./InviteDesk";
import MembershipDesk from "./MembershipDesk";
import { authenticatedHeaders } from "./lib/supabase-browser";
import { marketplaceCategories } from "@/lib/marketplace-taxonomy";

type View =
  | "Feed"
  | "People"
  | "Projects"
  | "Marketplace"
  | "Membership"
  | "Studio"
  | "Invites"
  | "My sales"
  | "Administration"
  | "My page";
type Modal =
  | ""
  | "onboard"
  | "post"
  | "project"
  | "product"
  | "profile"
  | "checkout"
  | "vault"
  | "scan";
type OwnProfile={avatar_name:string;display_name?:string|null;region:string;bio:string;skills?:string[];trust_status:string;is_public:boolean;banner_url?:string|null};
const views: View[] = [
  "Feed",
  "People",
  "Projects",
  "Marketplace",
  "Membership",
  "Studio",
  "Invites",
  "My sales",
  "Administration",
  "My page",
];

export default function Home() {
  const [view, setView] = useState<View>("Feed");
  const [modal, setModal] = useState<Modal>("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [joined, setJoined] = useState<string[]>(["soil-circles"]);
  const [promoted, setPromoted] = useState<string[]>(["npk432"]);
  const [saving, setSaving] = useState(false);
  const [scanSeconds, setScanSeconds] = useState(10);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const show = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3400);
  };
  const save = async (
    entity: string,
    title: string,
    data: Record<string, unknown>,
  ) => {
    setSaving(true);
    try {
      const marketplaceProduct = entity === "product";const profileEdit=entity==="profile-edit";
      const response = await fetch(marketplaceProduct ? "/api/marketplace" : profileEdit ? "/api/people" : "/api/community", {
        method: profileEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) },
        body: JSON.stringify(marketplaceProduct ? {action:"product-create",name:title,...data} : profileEdit ? {displayName:data.displayName,region:data.region,bio:data.bio,skills:String(data.skills||"").split(",").map(item=>item.trim()).filter(Boolean),isPublic:data.isPublic==="on"} : { entity, title, data }),
      });
      const result = await response.json() as {error?:string};
      if (!response.ok) throw new Error(result.error || "Save failed");
      show(marketplaceProduct ? `${title} submitted for marketplace review` : `${title} saved to the community`);
      setModal("");
      return true;
    } catch (error) {
      show(error instanceof Error ? error.message : "That could not be saved. Your draft is still here.");
      return false;
    } finally {
      setSaving(false);
    }
  };
  const join = (project: Project) => {
    setJoined((v) => (v.includes(project.id) ? v : [...v, project.id]));
    void save("task", `Joined ${project.title}`, {
      projectId: project.id,
      role: "contributor",
    });
  };
  const promote = (product: Product) => {
    const removing = promoted.includes(product.id);
    setPromoted((v) =>
      removing ? v.filter((id) => id !== product.id) : [...v, product.id],
    );
    void save(
      "promotion",
      `${removing ? "Removed" : "Promoting"} ${product.name}`,
      { productId: product.id, active: !removing },
    );
    show(
      removing
        ? "Removed from your page"
        : `${product.name} is now promoted on your page`,
    );
  };
  const uploadVault = async (e: FormEvent<HTMLElement>) => {
    const input = e.target as HTMLInputElement;
    if (input.type !== "file" || !input.files?.[0]) return;
    const form = new FormData();
    form.set("file", input.files[0]);
    show("Protecting your document…");
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: await authenticatedHeaders(),
        body: form,
      });
      if (!response.ok) throw new Error();
      show("Document secured in your private vault");
    } catch {
      show("Upload failed. Your file stayed on this device.");
    }
  };
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    // URL state is read once after hydration so public profile links open the requested workspace.
    if (requested && views.includes(requested as View)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView(requested as View);
    }
  }, []);
  useEffect(() => {
    if (modal !== "scan") return;
    const timer = window.setInterval(
      () => setScanSeconds((value) => (value <= 1 ? 0 : value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [modal]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options?: { signal?: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: unknown) =>
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => undefined);
    void register({
      name: "find_community_items",
      title: "Find community items",
      description:
        "Search FR333MAN people, projects and products and show matching results.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 1 } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input: unknown) => {
        const query =
          typeof (input as { query?: unknown })?.query === "string"
            ? (input as { query: string }).query.trim()
            : "";
        if (!query) throw new Error("A non-empty search query is required");
        setSearch(query);
        setView("People");
        return {
          query,
          matches: [
            ...people.map((p) => p.name),
            ...projects.map((p) => p.title),
            ...products.map((p) => p.name),
          ]
            .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 8),
        };
      },
    });
    void register({
      name: "open_project_collaboration",
      title: "Open project collaboration",
      description:
        "Open a FR333MAN project workspace by its stable project id.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", enum: projects.map((p) => p.id) },
        },
        required: ["projectId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input: unknown) => {
        const id =
          typeof (input as { projectId?: unknown })?.projectId === "string"
            ? (input as { projectId: string }).projectId
            : "";
        if (!projects.some((project) => project.id === id))
          throw new Error("Unknown project id");
        setSearch(id);
        setView("Projects");
        return { opened: id };
      },
    });
    return () => lifecycle.abort();
  }, []);
  const filteredPeople = useMemo(
    () =>
      people.filter((p) =>
        `${p.name} ${p.handle} ${p.skills.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [search],
  );
  return (
    <main
      onChangeCapture={uploadVault}
      onClickCapture={(e) => {
        const label =
          (e.target as HTMLElement).closest("button")?.textContent?.trim() ||
          "";
        if (label.startsWith("Continue with"))
          show(
            `${label.replace("Continue with", "").trim()} account connection needs its OAuth credentials before launch`,
          );
        else if (label === "Membership QR") setScanSeconds(10);
        else if (label === "•••")
          show("Post actions: save and report controls will appear here");
        else if (label.startsWith("♥ Love")) show("Love recorded");
        else if (label.startsWith("◯ Comment")) show("Comments opened");
        else if (label.startsWith("⌁ Share")) show("Post link copied");
        else if (label.startsWith("✦ Support")) {
          setView("Membership");
          show("Membership benefits opened");
        }
      }}
    >
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      <header className="topbar">
        <button
          className="wordmark"
          onClick={() => setView("Feed")}
          aria-label="FR333MAN home"
        >
          <b>
            FR<span>333</span>MAN
          </b>
          <small>UNITED AS INTENDED</small>
        </button>
        <nav aria-label="Main navigation">
          {views.map((item) => (
            <button
              key={item}
              className={view === item ? "active" : ""}
              onClick={() => setView(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="header-tools">
          <label className="search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people, projects, products"
            />
          </label>
          <button className="avatar-button" onClick={() => setView("My page")}>
            <span>FK</span>
            <b>Francois</b>
          </button>
        </div>
      </header>
      <div className="mobile-nav">
        {views.map((item) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            onClick={() => setView(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {view === "Feed" && (
        <Feed
          onView={setView}
          onModal={setModal}
          onPromote={promote}
          promoted={promoted}
          onJoin={join}
          joined={joined}
        />
      )}
      {view === "People" && (
        <PeopleView
          people={filteredPeople}
          search={search}
          setSearch={setSearch}
        />
      )}
      {view === "Projects" && (
        <ProjectsView joined={joined} onJoin={join} onModal={setModal} />
      )}
      {view === "Marketplace" && (
        <MarketView
          promoted={promoted}
          onPromote={promote}
          onSupport={(product) => {
            setSelectedProduct(product);
            setModal("checkout");
          }}
          onAdd={() => setModal("product")}
        />
      )}
      {view === "Membership" && <MembershipDesk show={show} />}
      {view === "Studio" && <StudioView onModal={setModal} show={show} />}
      {view === "Invites" && <InviteDesk show={show} />}
      {view === "My sales" && <SalesDesk show={show} />}
      {view === "Administration" && <AdminDesk show={show} />}
      {view === "My page" && (
        <MyPage
          promoted={promoted}
          onModal={setModal}
          setView={setView}
        />
      )}
      {modal && (
        <PlatformModal
          kind={modal}
          product={selectedProduct}
          seconds={scanSeconds}
          saving={saving}
          show={show}
          onClose={() => setModal("")}
          onSave={save}
        />
      )}
      <PolicyFooter />
    </main>
  );
}

function Feed({
  onView,
  onModal,
  onPromote,
  promoted,
  onJoin,
  joined,
}: {
  onView: (v: View) => void;
  onModal: (m: Modal) => void;
  onPromote: (p: Product) => void;
  promoted: string[];
  onJoin: (p: Project) => void;
  joined: string[];
}) {
  return (
    <div className="workspace">
      <aside className="left-rail">
        <section className="identity-card">
          <div className="mini-cover"></div>
          <div className="profile-orb">FK</div>
          <h2>Francois Kamffer</h2>
          <p>@fr333man · Randburg</p>
          <span className="people-badge">PEOPLE · LIVENESS CHECKED</span>
          <dl>
            <div>
              <dt>Membership</dt>
              <dd>Preview</dd>
            </div>
            <div>
              <dt>Projects</dt>
              <dd>3</dd>
            </div>
            <div>
              <dt>Promoting</dt>
              <dd>{promoted.length}</dd>
            </div>
          </dl>
          <button onClick={() => onView("My page")}>Open my page</button>
        </section>
        <section className="principles">
          <p>OUR COMMON GROUND</p>
          <b>
            Human by nature.
            <br />
            United as intended.
          </b>
          <span>
            People before labels. No standing by race, religion or political
            party. Ideas are examined respectfully.
          </span>
        </section>
      </aside>
      <section className="feed-column">
        <div className="question-card">
          <span>QUESTION OF THE DAY · 24H</span>
          <h1>
            Would you believe what you believe if you questioned those you
            believe?
          </h1>
          <button onClick={() => onModal("post")}>
            Share your answer <b>→</b>
          </button>
        </div>
        <div className="composer">
          <div className="profile-orb small">FK</div>
          <button onClick={() => onModal("post")}>
            Share a question, idea or practical build…
          </button>
          <button
            aria-label="Start a live stream"
            onClick={() => onView("Studio")}
          >
            ◉ Live
          </button>
        </div>
        <article className="post">
          <PostHead person={people[1]} time="18 min" />
          <p>
            We mapped three collection points for the clean-water pilot. We
            still need a logistics lead and two testing volunteers for Saturday.
          </p>
          <div className="project-inline">
            <span>ACTIVE PROJECT · 68% FUNDED</span>
            <h3>Neighbourhood Water Resilience</h3>
            <div className="progress">
              <i style={{ width: "68%" }}></i>
            </div>
            <button onClick={() => onJoin(projects[0])}>
              {joined.includes(projects[0].id)
                ? "Joined ✓"
                : "Join this project"}
            </button>
          </div>
          <PostActions postId="water-pilot" show={() => {}} />
        </article>
        <article className="post visual-post">
          <PostHead person={people[0]} time="1 hr" />
          <p>
            The physical hub is the doorway. Scan a question, sit down, then
            continue the conversation with people here.
          </p>
          <img
            src="/freeman-market-concept.jpg"
            alt="FR333MAN outdoor conversation and product hub"
          />
          <PostActions postId="physical-hub" show={() => {}} />
        </article>
        <article className="post">
          <PostHead person={people[2]} time="3 hrs" />
          <p>
            I am promoting Kabelo’s solar workshop passes this week.
            Cross-promotion works when the product and the purpose are both
            clear.
          </p>
          <ProductCard
            product={products[2]}
            promoted={promoted.includes(products[2].id)}
            onPromote={() => onPromote(products[2])}
          />
          <PostActions postId="solar-workshop" show={() => {}} />
        </article>
      </section>
      <aside className="right-rail">
        <section className="live-now">
          <div>
            <span>LIVE FRIDAY · 16:20</span>
            <b>The Debrief</b>
            <p>
              Water, soil, autonomy—and the strongest answers from this week.
            </p>
          </div>
          <button onClick={() => onView("Studio")}>Set reminder</button>
        </section>
        <section className="side-list">
          <div className="section-head">
            <h3>Projects need hands</h3>
            <button onClick={() => onView("Projects")}>View all</button>
          </div>
          {projects.slice(0, 3).map((p) => (
            <button
              className="side-project"
              key={p.id}
              onClick={() => onView("Projects")}
            >
              <i style={{ background: p.accent }}>{p.icon}</i>
              <span>
                <b>{p.title}</b>
                <small>
                  {p.openTasks} open tasks · {p.region}
                </small>
              </span>
            </button>
          ))}
        </section>
        <section className="side-list">
          <div className="section-head">
            <h3>People to meet</h3>
            <button onClick={() => onView("People")}>Browse</button>
          </div>
          {people.slice(1, 4).map((p) => (
            <a
              className="side-person"
              href={`/people/${p.handle.slice(1)}`}
              key={p.handle}
            >
              <span
                className="profile-orb tiny"
                style={{ background: p.color }}
              >
                {p.initials}
              </span>
              <span>
                <b>{p.name}</b>
                <small>
                  {p.skills[0]} · {p.region}
                </small>
              </span>
              <em>View</em>
            </a>
          ))}
        </section>
      </aside>
    </div>
  );
}

function PeopleView({
  people: members,
  search,
  setSearch,
}: {
  people: Person[];
  search: string;
  setSearch: (s: string) => void;
}) {
  const [remotePeople,setRemotePeople]=useState<Person[]>([]);
  useEffect(()=>{const controller=new AbortController();void fetch("/api/people",{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as {profiles?:Array<{avatar_name:string;display_name?:string;region:string;bio:string;skills?:string[];trust_status:string}>};const mapped=(data.profiles??[]).map((profile,index)=>{const name=profile.display_name||profile.avatar_name;return{name,handle:`@${profile.avatar_name}`,initials:name.split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase(),region:profile.region,status:profile.trust_status.replaceAll("_"," ").toUpperCase(),color:["#e9b63c","#28a887","#709b48","#cf6e3a","#5a79bd"][index%5],skills:profile.skills??[],bio:profile.bio||"This People member has not added a public biography yet.",projects:0}});setRemotePeople(mapped)}).catch(()=>undefined);return()=>controller.abort()},[]);
  const displayMembers=(remotePeople.length?remotePeople:members).filter(person=>`${person.name} ${person.handle} ${person.region} ${person.skills.join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="page-shell">
      <header className="page-title">
        <div>
          <p>PEOPLE, NOT PROFILES</p>
          <h1>Find capable hands.</h1>
          <span>
            Meet people by skills, projects and region—not by status labels.
          </span>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Try water, soil, media…"
        />
      </header>
      <div className="people-grid">
        {displayMembers.map((p) => (
          <a
            className="person-card"
            href={`/people/${p.handle.slice(1)}`}
            key={p.handle}
          >
            <div
              className="person-cover"
              style={{ "--member": p.color } as React.CSSProperties}
            >
              <span>{p.initials}</span>
              <em>{p.region}</em>
            </div>
            <div>
              <span className="people-badge">PEOPLE · {p.status}</span>
              <h2>{p.name}</h2>
              <p>{p.bio}</p>
              <div className="skill-row">
                {p.skills.map((s) => (
                  <b key={s}>{s}</b>
                ))}
              </div>
              <footer>
                <span>{p.projects} projects</span>
                <strong>Open page →</strong>
              </footer>
            </div>
          </a>
        ))}
      </div>
      {!displayMembers.length && (
        <div className="empty">
          No people match “{search}”. Try a skill or region.
        </div>
      )}
    </section>
  );
}

function ProjectsView({
  joined,
  onJoin,
  onModal,
}: {
  joined: string[];
  onJoin: (p: Project) => void;
  onModal: (m: Modal) => void;
}) {
  return (
    <section className="page-shell">
      <header className="page-title">
        <div>
          <p>BUILD TOGETHER</p>
          <h1>Projects with work to do.</h1>
          <span>Open plans, clear tasks and visible stewardship.</span>
        </div>
        <button className="primary" onClick={() => onModal("project")}>
          + Propose a project
        </button>
      </header>
      <div className="project-grid">
        {projects.map((p) => (
          <article className="project-card" key={p.id}>
            <div className="project-top" style={{ background: p.accent }}>
              <span>{p.icon}</span>
              <em>{p.category}</em>
            </div>
            <div>
              <span className="status-line">
                {p.status} · {p.region}
              </span>
              <h2>{p.title}</h2>
              <p>{p.summary}</p>
              <div className="progress">
                <i
                  style={{ width: `${p.progress}%`, background: p.accent }}
                ></i>
              </div>
              <div className="project-meta">
                <span>
                  <b>{p.progress}%</b> progress
                </span>
                <span>
                  <b>{p.openTasks}</b> open tasks
                </span>
                <span>
                  <b>{p.people}</b> people
                </span>
              </div>
              <div className="task-list">
                {p.tasks.map((task, index) => (
                  <label key={task}>
                    <input type="checkbox" defaultChecked={index === 0} />
                    <span>{task}</span>
                  </label>
                ))}
              </div>
              <button
                className={joined.includes(p.id) ? "joined" : "primary"}
                onClick={() => onJoin(p)}
              >
                {joined.includes(p.id)
                  ? "You are collaborating ✓"
                  : "Join project"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MarketView({
  promoted,
  onPromote,
  onSupport,
  onAdd,
}: {
  promoted: string[];
  onPromote: (p: Product) => void;
  onSupport: (p: Product) => void;
  onAdd: () => void;
}) {
  const [category, setCategory] = useState("All");
  const [remoteProducts, setRemoteProducts] = useState<Product[]>([]);
  useEffect(() => { const controller=new AbortController(); void fetch("/api/marketplace",{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as {products?:Product[]};setRemoteProducts(data.products??[])}).catch(()=>undefined);return()=>controller.abort(); }, []);
  const availableProducts = remoteProducts.length ? remoteProducts : products;
  const categories = ["All", ...Array.from(new Set(availableProducts.map(product=>product.category)))];
  const list = availableProducts.filter(
    (p) => category === "All" || p.category === category,
  );
  return (
    <section className="page-shell">
      <header className="page-title">
        <div>
          <p>MEMBER MARKETPLACE</p>
          <h1>Buy local. Promote each other.</h1>
          <span>
            Products stay owned by their makers; every promoter’s relationship
            is visible.
          </span>
        </div>
        <button className="primary" onClick={onAdd}>
          + List a product
        </button>
      </header>
      <div className="filters">
        {categories.map((c) => (
          <button
            className={category === c ? "active" : ""}
            onClick={() => setCategory(c)}
            key={c}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="market-grid">
        {list.map((p, index) => (
          <article className="market-card" key={p.id}>
            <div className={`product-visual product-${index % 4}`}>
              {p.images?.[0]?.url?<img src={p.images[0].url} alt={p.images[0].alt}/>:<span>{p.mark}</span>}
              <em>{p.category}</em>
            </div>
            <div>
              <small>
                BY <a href={`/people/${p.ownerHandle.slice(1)}`}>{p.owner}</a>
              </small>
              <h2>{p.name}</h2>
              <p>{p.description}</p>
              <div className="price">
                <b>{p.price}</b>
                <span>Eligible products may also appear in the monthly membership catalogue</span>
              </div>
              <div className="card-actions">
                <button className="primary" onClick={() => p.checkoutEnabled===false ? window.location.assign(`/products/${encodeURIComponent(p.slug||p.id)}`) : onSupport(p)}>
                  {p.checkoutEnabled===false ? "View product" : p.id === "cdswater"
                    ? "Review availability"
                    : "Buy or donate"}
                </button>
                <button
                  className={promoted.includes(p.id) ? "promoted" : ""}
                  onClick={() => onPromote(p)}
                >
                  {promoted.includes(p.id) ? "Promoting ✓" : "Promote"}
                </button>
              </div>
              <div className="channels">
                <span>
                  {p.id === "cdswater"
                    ? "PAYMENT REVIEW REQUIRED"
                    : "Paystack checkout"}
                </span>
                <span>Facebook</span>
                <span>Gumtree</span>
                <span>eBay</span>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="legal-note">
        Products are purchased directly from the named seller unless clearly
        marked as included in a People Membership. The seller remains
        responsible for the product, delivery, returns and taxes.
      </p>
    </section>
  );
}

function StudioView({
  onModal,
  show,
}: {
  onModal: (m: Modal) => void;
  show: (s: string) => void;
}) {
  return (
    <section className="studio">
      <div className="studio-stage">
        <div className="live-preview">
          <span>PREVIEW</span>
          <div className="studio-mark">
            <b>
              FR<span>333</span>MAN
            </b>
            <p>FREE YOUR MIND</p>
          </div>
          <footer>
            <i></i>
            <b>Friday Debrief · 16:20</b>
            <span>0 watching</span>
          </footer>
        </div>
        <div className="studio-controls">
          <button onClick={() => show("Camera test passed")}>▣ Camera</button>
          <button onClick={() => show("DJI Mic input selected")}>
            ⌁ DJI Mic
          </button>
          <button onClick={() => show("Screen sharing is ready")}>
            ▤ Share screen
          </button>
          <button className="go-live" onClick={() => onModal("post")}>
            Go live
          </button>
        </div>
      </div>
      <aside>
        <p>WEEKLY BROADCAST</p>
        <h1>
          One idea.
          <br />A week of conversation.
        </h1>
        <ol>
          <li>
            <b>Wednesday</b>
            <span>Publish the 15–30 minute core video.</span>
          </li>
          <li>
            <b>Thursday</b>
            <span>Post a poll and collect member questions.</span>
          </li>
          <li>
            <b>Friday · 16:20</b>
            <span>Debrief live with a guest and community Q&amp;A.</span>
          </li>
          <li>
            <b>Weekend</b>
            <span>Record willing stall visitors and publish short clips.</span>
          </li>
        </ol>
        <button onClick={() => show("Broadcast destinations opened")}>
          Manage broadcast destinations
        </button>
        <div className="equipment">
          <span>INPUTS</span>
          <b>Konftel conference camera</b>
          <b>DJI Mic receiver · USB audio</b>
        </div>
      </aside>
    </section>
  );
}

function MyPage({
  promoted,
  onModal,
  setView,
}: {
  promoted: string[];
  onModal: (m: Modal) => void;
  setView: (v: View) => void;
}) {
  const [profile,setProfile]=useState<OwnProfile|null>(null);
  useEffect(()=>{const controller=new AbortController();void authenticatedHeaders().then(headers=>fetch("/api/people?mine=true",{headers,signal:controller.signal})).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as {profile?:OwnProfile};setProfile(data.profile??null)}).catch(()=>undefined);return()=>controller.abort()},[]);
  const profileName=profile?.display_name||profile?.avatar_name||"Francois Kamffer";const profileHandle=profile?.avatar_name?`@${profile.avatar_name}`:"@fr333man";const profileInitials=profileName.split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase();const profileSkills=profile?.skills?.length?profile.skills:["Water","Soil biology","Research","Broadcasting"];
  return (
    <section className="my-page">
      <header className="profile-header">
        <div className="profile-banner">
          <img src={profile?.banner_url||"/freeman-market-concept.jpg"} alt="FR333MAN Autonomy Hub" />
        </div>
        <div className="profile-main">
          <div className="profile-orb hero-orb">{profileInitials}</div>
          <div>
            <span className="people-badge">PEOPLE · {profile?.trust_status?.replaceAll("_"," ").toUpperCase()||"ACTIVATION 3 OF 5"}</span>
            <h1>{profileName}</h1>
            <p>{profileHandle} · {profile?.region||"Randburg"}</p>
          </div>
          <div className="profile-buttons">
            <button onClick={() => onModal("scan")}>Membership QR</button>
            <button onClick={() => onModal("profile")}>Edit profile</button>
            <a className="primary" href="/onboarding">
              Continue activation
            </a>
          </div>
        </div>
      </header>
      <div className="profile-layout">
        <section>
          <article className="about-card">
            <p>ABOUT</p>
            <h2>{profile?.bio||"Questions matter more than conclusions."}</h2>
            <span>
              This public introduction, region and the skills below are controlled by the signed-in People member.
            </span>
            <div className="skill-row">
              {profileSkills.map(skill=><b key={skill}>{skill}</b>)}
            </div>
          </article>
          <article className="profile-section">
            <div className="section-head">
              <h2>Projects</h2>
              <button onClick={() => setView("Projects")}>Manage</button>
            </div>
            {projects.slice(0, 2).map((p) => (
              <div className="profile-project" key={p.id}>
                <i style={{ background: p.accent }}>{p.icon}</i>
                <span>
                  <b>{p.title}</b>
                  <small>
                    {p.openTasks} open tasks · {p.progress}% complete
                  </small>
                </span>
              </div>
            ))}
          </article>
          <article className="profile-section">
            <div className="section-head">
              <h2>Products I promote</h2>
              <button onClick={() => setView("Marketplace")}>
                Add products
              </button>
            </div>
            {products
              .filter((p) => promoted.includes(p.id))
              .map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  promoted
                  onPromote={() => {}}
                />
              ))}
          </article>
        </section>
        <aside>
          <section className="activation">
            <p>ACCOUNT ACTIVATION</p>
            <h2>Open now. Verify before trust features unlock.</h2>
            <div className="activation-progress">
              <i></i>
              <i></i>
              <i></i>
              <i></i>
              <i></i>
            </div>
            <ul>
              <li className="done">Profile and avatar name</li>
              <li className="done">Entry account connected</li>
              <li className="done">10 free-thinking questions</li>
              <li>Identity, liveness &amp; member witness</li>
              <li>$10 opening fee · due on day 14</li>
            </ul>
            <a className="primary" href="/onboarding">
              Continue activation
            </a>
            <small>
              Cancel within 14 days before the opening fee becomes due.
            </small>
          </section>
          <section className="wallet membership-card">
            <p>PEOPLE MEMBERSHIP</p>
            <strong>Monthly</strong>
            <span>Choose benefits and eligible products each month.</span>
            <div>
              <button onClick={() => setView("Membership")}>Choose benefits</button>
              <button onClick={() => setView("Marketplace")}>
                View products
              </button>
            </div>
          </section>
          <section className="vault">
            <p>PRIVATE DOCUMENT VAULT</p>
            <h3>Passport · Driver licence · permits</h3>
            <span>
              Encrypted files are never shown from the public QR. Access
              requires a verified request, lawful basis or your consent, and an
              audit trail.
            </span>
            <button onClick={() => onModal("vault")}>Open vault</button>
          </section>
        </aside>
      </div>
    </section>
  );
}

function PlatformModal({
  kind,
  product,
  seconds,
  saving,
  show,
  onClose,
  onSave,
}: {
  kind: Modal;
  product: Product | null;
  seconds: number;
  saving: boolean;
  show: (s: string) => void;
  onClose: () => void;
  onSave: (
    e: string,
    t: string,
    d: Record<string, unknown>,
  ) => Promise<boolean>;
}) {
  const [profileDraft,setProfileDraft]=useState<OwnProfile|null>(null);
  useEffect(()=>{if(kind!=="profile")return;let active=true;void authenticatedHeaders().then(headers=>fetch("/api/people?mine=true",{headers})).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as {profile?:OwnProfile};if(active)setProfileDraft(data.profile??{avatar_name:"fr333man",display_name:"Francois Kamffer",region:"Randburg",bio:"",skills:[],trust_status:"pending_review",is_public:false})}).catch(()=>{if(active)setProfileDraft({avatar_name:"fr333man",display_name:"Francois Kamffer",region:"Randburg",bio:"",skills:[],trust_status:"pending_review",is_public:false})});return()=>{active=false}},[kind]);
  const submit = (entity: string) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void onSave(
      entity,
      String(form.get("title") || form.get("name") || entity),
      Object.fromEntries(form.entries()),
    );
  };
  const checkout = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product) return;
    const form = new FormData(e.currentTarget);
    const amount = Number(product.price.replace(/[^0-9.]/g, ""));
    const response = await fetch("/api/paystack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        amount,
        productId: product.id,
        productName: product.name,
        policyAccepted: form.get("policyAccepted") === "on",
      }),
    });
    const result = (await response.json()) as {
      configured?: boolean;
      error?: string;
      message?: string;
      data?: { authorization_url?: string };
    };
    if (response.ok && result.data?.authorization_url) {
      window.location.assign(result.data.authorization_url);
      return;
    }
    show(result.error || result.message || "Checkout is not available yet");
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {kind === "onboard" && (
          <>
            <p>ACTIVATE YOUR PAGE</p>
            <h2>Complete the secure onboarding workflow.</h2>
            <a className="primary full" href="/onboarding">
              Open onboarding
            </a>
          </>
        )}
        {kind === "post" && (
          <form onSubmit={submit("post")}>
            <p>SHARE WITH PEOPLE</p>
            <h2>Start a useful conversation.</h2>
            <label>
              Headline
              <input
                name="title"
                required
                placeholder="What are you questioning or building?"
              />
            </label>
            <label>
              Your thought
              <textarea
                name="body"
                required
                rows={6}
                placeholder="Give people enough context to respond well."
              />
            </label>
            <label className="check">
              <input type="checkbox" name="recordingConsent" /> This post
              relates to a recorded conversation with consent.
            </label>
            <button className="primary">
              {saving ? "Publishing…" : "Publish"}
            </button>
          </form>
        )}
        {kind === "profile" && (
          profileDraft ? <form onSubmit={submit("profile-edit")}>
            <p>EDIT MY PEOPLE PROFILE</p>
            <h2>Control what People see.</h2>
            <label>Display name<input name="displayName" required value={profileDraft.display_name||""} onChange={event=>setProfileDraft(current=>current&&({...current,display_name:event.target.value}))} /></label>
            <label>Region<input name="region" required value={profileDraft.region} onChange={event=>setProfileDraft(current=>current&&({...current,region:event.target.value}))} /></label>
            <label>Public biography<textarea name="bio" required rows={5} value={profileDraft.bio} onChange={event=>setProfileDraft(current=>current&&({...current,bio:event.target.value}))} /></label>
            <label>Skills, separated by commas<input name="skills" value={(profileDraft.skills||[]).join(", ")} onChange={event=>setProfileDraft(current=>current&&({...current,skills:event.target.value.split(",").map(item=>item.trim())}))} /></label>
            <label className="check"><input type="checkbox" name="isPublic" checked={profileDraft.is_public} onChange={event=>setProfileDraft(current=>current&&({...current,is_public:event.target.checked}))} /> Publish my profile after approval.</label>
            <button className="primary">{saving ? "Saving…" : "Save profile"}</button>
          </form> : <div className="empty-work"><b>Loading your profile…</b></div>
        )}
        {kind === "project" && (
          <form onSubmit={submit("project")}>
            <p>PROPOSE A PROJECT</p>
            <h2>Turn an idea into shared work.</h2>
            <label>
              Project name
              <input name="title" required />
            </label>
            <label>
              Outcome
              <textarea name="outcome" required rows={3} />
            </label>
            <label>
              First open task
              <input name="firstTask" required />
            </label>
            <label>
              Region
              <select name="region">
                <option>Gauteng</option>
                <option>South Africa</option>
                <option>Remote / united</option>
              </select>
            </label>
            <button className="primary">
              {saving ? "Saving…" : "Create project"}
            </button>
          </form>
        )}
        {kind === "product" && (
          <form onSubmit={submit("product")}>
            <p>LIST A PRODUCT</p>
            <h2>Make it easy to support your work.</h2>
            <label>
              Product name
              <input name="title" required />
            </label>
            <label>
              What it is
              <textarea name="description" required rows={3} />
            </label>
            <label>
              Price
              <input name="price" placeholder="R 0.00" required />
            </label>
            <label>
              Category
              <select name="category">
                {marketplaceCategories.map(category=><option key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Condition
              <select name="condition">
                <option value="new">New</option>
                <option value="used">Used</option>
                <option value="refurbished">Refurbished</option>
                <option value="digital">Digital</option>
                <option value="service">Service</option>
              </select>
            </label>
            <label>
              Available stock
              <input name="stock" type="number" min="0" defaultValue="1" required />
            </label>
            <label className="check">
              <input type="checkbox" name="membershipEligible" /> Make this product eligible for the monthly membership catalogue after review.
            </label>
            <label className="check">
              <input type="checkbox" required /> I confirm this item is lawful
              and permitted by the{" "}
              <a href="/policies/acceptable-use">market rules</a>.
            </label>
            <button className="primary">
              {saving ? "Saving…" : "Submit for listing review"}
            </button>
          </form>
        )}
        {kind === "checkout" && product && (
          <form onSubmit={checkout}>
            <p>SECURE CHECKOUT</p>
            <h2>{product.name}</h2>
            <div className="points-total">
              Total <b>{product.price}</b>
            </div>
            {product.id === "cdswater" ? (
              <div className="compliance-warning">
                <b>Manual payment review required</b>
                <span>
                  This product category cannot use Paystack until the merchant
                  has written category approval and the legal product checks are
                  complete.
                </span>
              </div>
            ) : (
              <>
                <label>
                  Email for receipt
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </label>
                <label className="check">
                  <input name="policyAccepted" type="checkbox" required /> I
                  agree to the <a href="/policies/terms">terms</a>,{" "}
                  <a href="/policies/refunds">refund policy</a> and{" "}
                  <a href="/policies/delivery">delivery policy</a>.
                </label>
                <button className="primary">Continue to Paystack</button>
              </>
            )}
            <small>
              The named seller is responsible for fulfilment. FR333MAN does not
              process one member&apos;s funds on behalf of another.
            </small>
          </form>
        )}
        {kind === "vault" && (
          <form onSubmit={submit("credential")}>
            <p>PRIVATE DOCUMENT VAULT</p>
            <h2>Add a protected credential.</h2>
            <label>
              Document type
              <select name="title">
                <option>Passport</option>
                <option>Driver licence</option>
                <option>Professional permit</option>
              </select>
            </label>
            <label className="upload-box">
              Choose encrypted upload
              <input name="file" type="file" accept="image/*,.pdf" required />
            </label>
            <label className="check">
              <input type="checkbox" required /> I understand no document is
              displayed by the public QR.
            </label>
            <button className="primary">
              {saving ? "Encrypting…" : "Upload securely"}
            </button>
          </form>
        )}
        {kind === "scan" && (
          <div className="scan-view">
            <p>MEMBERSHIP CARD PREVIEW</p>
            <div
              className="static-qr"
              aria-label="Static membership QR preview"
            >
              <i></i>
              <i></i>
              <i></i>
              <i></i>
              <i></i>
              <i></i>
              <i></i>
              <i></i>
              <i></i>
            </div>
            <h2>Francois Kamffer</h2>
            <span>@fr333man · PEOPLE · FRL-1042</span>
            {seconds > 0 ? (
              <>
                <strong>{seconds}s</strong>
                <small>
                  This public profile preview closes on this device when the
                  timer reaches zero.
                </small>
              </>
            ) : (
              <>
                <strong>Closed</strong>
                <small>
                  Sign in and submit a verified, purpose-limited request to ask
                  for credentials.
                </small>
                <button className="primary" onClick={onClose}>
                  Sign in to request access
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function PostHead({ person, time }: { person: Person; time: string }) {
  return (
    <header className="post-head">
      <a
        href={`/people/${person.handle.slice(1)}`}
        className="profile-orb tiny"
        style={{ background: person.color }}
      >
        {person.initials}
      </a>
      <span>
        <a href={`/people/${person.handle.slice(1)}`}>{person.name}</a>
        <small>
          {person.handle} · {time}
        </small>
      </span>
      <button>•••</button>
    </header>
  );
}
type FeedComment = {
  id: string;
  author: string;
  body: string;
  age: string;
  loves: number;
};
const starterComments: Record<string, FeedComment[]> = {
  "water-pilot": [
    { id: "w1", author: "Kabelo Nkosi", body: "I can help confirm transport for Saturday morning.", age: "6 min", loves: 8 },
    { id: "w2", author: "Thandi Mokoena", body: "Please share the testing checklist before the volunteer briefing.", age: "12 min", loves: 5 },
    { id: "w3", author: "Lerato Botha", body: "I can document the route and publish the findings.", age: "15 min", loves: 3 },
  ],
  "physical-hub": [
    { id: "h1", author: "Amina Dlamini", body: "The question cards make it easier for new people to join a conversation.", age: "24 min", loves: 11 },
    { id: "h2", author: "Kabelo Nkosi", body: "Let us add a QR for the current project tasks as well.", age: "41 min", loves: 7 },
  ],
  "solar-workshop": [
    { id: "s1", author: "Francois Kamffer", body: "I will share it with the Randburg project circle.", age: "1 hr", loves: 9 },
    { id: "s2", author: "Amina Dlamini", body: "A short safety preview would help people know what to expect.", age: "2 hrs", loves: 6 },
  ],
};
function PostActions({ show, postId }: { show: (s: string) => void; postId: string }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"Top" | "Newest">("Top");
  const [loved, setLoved] = useState(false);
  const [comments, setComments] = useState(starterComments[postId] || []);
  const [draft, setDraft] = useState("");
  const visible = [...comments].sort((a, b) =>
    filter === "Top" ? b.loves - a.loves : b.id.localeCompare(a.id),
  );
  const submitComment = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setComments((current) => [
      ...current,
      { id: `${Date.now()}`, author: "Francois Kamffer", body, age: "now", loves: 0 },
    ]);
    setDraft("");
    setOpen(true);
  };
  return (
    <>
      <footer className="post-actions">
        <button
          className={loved ? "loved" : ""}
          onClick={() => {
            setLoved((value) => !value);
            show(loved ? "Love removed" : "Love recorded");
          }}
        >
          {loved ? "♥" : "♡"} Love
        </button>
        <button onClick={() => setOpen((value) => !value)}>
          ◯ Comment ({comments.length})
        </button>
        <button onClick={() => show("Post link copied")}>⌁ Share</button>
        <button onClick={() => show("Support opened")}>✦ Support</button>
      </footer>
      {open && (
        <section className="comment-panel" aria-label="Post comments">
          <header>
            <b>Comments</b>
            <div aria-label="Filter comments">
              {(["Top", "Newest"] as const).map((option) => (
                <button
                  className={filter === option ? "active" : ""}
                  onClick={() => setFilter(option)}
                  key={option}
                >
                  {option}
                </button>
              ))}
            </div>
          </header>
          <div className="comment-list">
            {visible.map((comment) => (
              <article key={comment.id}>
                <span>{comment.author.slice(0, 1)}</span>
                <div>
                  <b>{comment.author}</b>
                  <p>{comment.body}</p>
                  <small>{comment.age} · ♥ {comment.loves}</small>
                </div>
              </article>
            ))}
          </div>
          <form onSubmit={submitComment}>
            <input
              aria-label="Write a comment"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a useful comment…"
            />
            <button disabled={!draft.trim()}>Comment</button>
          </form>
        </section>
      )}
    </>
  );
}
function ProductCard({
  product,
  promoted,
  onPromote,
}: {
  product: Product;
  promoted: boolean;
  onPromote: () => void;
}) {
  return (
    <div className="product-inline">
      {product.images?.[0]?.url?<img src={product.images[0].url} alt={product.images[0].alt}/>:<i>{product.mark}</i>}
      <span>
        <small>
          {product.category} · {product.owner}
        </small>
        <b>{product.name}</b>
        <em>{product.price}</em>
      </span>
      <button className={promoted ? "promoted" : ""} onClick={onPromote}>
        {promoted ? "Promoting ✓" : "Promote"}
      </button>
    </div>
  );
}
function PolicyFooter() {
  return (
    <footer className="policy-footer">
      <span>FR333MAN · United as intended</span>
      <nav aria-label="Legal and support">
        <a href="/policies/terms">Terms</a>
        <a href="/policies/privacy">Privacy &amp; POPIA</a>
        <a href="/policies/refunds">Refunds</a>
        <a href="/policies/delivery">Delivery</a>
        <a href="/policies/acceptable-use">Market rules</a>
        <a href="/policies/contact">Contact</a>
      </nav>
    </footer>
  );
}
