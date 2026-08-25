'use client';

import { FormEvent, useState } from 'react';

const interests = ['Water', 'Soil & food', 'Independent research', 'Practical builds', 'Pets', 'Live conversations'];

export default function Home() {
  const [joined, setJoined] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (item: string) => setSelected((items) => items.includes(item) ? items.filter((x) => x !== item) : [...items, item]);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setJoined(true); };

  return <main>
    <nav className="nav shell"><a className="brand" href="#top">FR<span>333</span>MAN</a><div className="nav-links"><a href="#explore">Explore</a><a href="#products">Field tools</a><a href="#membership">Membership</a></div><a className="button small" href="#join">Join the movement</a></nav>
    <section className="hero shell" id="top">
      <div><p className="eyebrow">Independent minds · practical freedom</p><h1>Question deeply.<br/><em>Build freely.</em></h1><p className="lede">A social network for people who research for themselves, test ideas in the real world and share what they learn.</p><div className="hero-actions"><a className="button" href="#join">Enter the community</a><a className="text-link" href="#question">Answer today’s question →</a></div><div className="trust"><span>WEEKLY FIELD NOTES</span><span>LIVE CONVERSATIONS</span><span>PRACTICAL BUILDS</span></div></div>
      <aside className="question-card" id="question"><div className="card-top"><span>QUESTION / 001</span><span className="open">OPEN</span></div><p className="quote">“</p><h2>What would freedom look like in your life if you had to practise it—not just believe in it?</h2><a href="#join">Post your answer ↗</a><div className="responses"><span>FK&nbsp;&nbsp;SM&nbsp;&nbsp;AK</span><span>Join the first conversation</span></div></aside>
    </section>
    <div className="ticker">RESEARCH　•　WATER　•　SOIL　•　COMMUNITY　•　SELF-RELIANCE　•　OPEN DIALOGUE　•　RESEARCH　•　WATER</div>
    <section className="section shell" id="explore"><header className="section-heading"><p className="eyebrow">Inside the movement</p><h2>Ideas become useful<br/>when you put them to work.</h2></header><div className="pillars">
      <article><span>01</span><div className="symbol">?</div><h3>Question the default</h3><p>Follow the evidence, challenge assumptions and bring a respectful counterpoint.</p><a href="#join">Enter the conversation →</a></article>
      <article><span>02</span><div className="symbol water">≈</div><h3>Build practical autonomy</h3><p>Explore real projects around water, growing, food, energy and resilient living.</p><a href="#products">See the field tools →</a></article>
      <article><span>03</span><div className="symbol grow">↟</div><h3>Share what works</h3><p>Document experiments, source your ideas and help the community learn faster.</p><a href="#join">Start a project log →</a></article>
    </div></section>
    <section className="products" id="products"><div className="shell"><header className="section-heading light"><p className="eyebrow">Tools for the field</p><h2>Three everyday systems.<br/>One independent life.</h2></header><div className="product-grid">
      <article className="product water-product"><p>01 / WATER</p><div className="product-icon">◉</div><h3>CDSwater</h3><p>Water purification and disinfection products for informed, practical household use.</p><a href="#join">Explore water →</a></article>
      <article className="product soil-product"><p>02 / SOIL</p><div className="product-icon">✣</div><h3>NPK 432</h3><p>Mealworm-frass soil activator designed to feed the biology beneath your plants.</p><a href="#join">Explore soil →</a></article>
      <article className="product pet-product"><p>03 / PETS</p><div className="product-icon">◆</div><h3>Fido</h3><p>Thoughtful dog food and treats for the companions who share the journey.</p><a href="#join">Explore pets →</a></article>
    </div></div></section>
    <section className="membership shell" id="membership"><div><p className="eyebrow">Membership</p><h2>Don’t just follow.<br/><em>Take part.</em></h2><p>Start free. Upgrade when you’re ready for the full library, live replays, project circles and member offers.</p></div><div className="plans">
      <article><div><p>EXPLORER</p><h3>Free</h3><span>For curious independent minds</span></div><ul><li>Question of the Day</li><li>Public field notes</li><li>Event announcements</li></ul><a className="button secondary" href="#join">Start exploring</a></article>
      <article className="featured"><div className="recommended">FOUNDING MEMBERSHIP</div><div><p>BUILDER</p><h3>Paystack-ready</h3><span>Monthly or annual access</span></div><ul><li>Complete research library</li><li>Member conversations</li><li>Live replays and project logs</li><li>Member product offers</li></ul><a className="button" href="#join">Reserve my place</a><small>Secure subscription checkout will connect to your Paystack plan.</small></article>
    </div></section>
    <section className="join" id="join"><div className="shell join-grid"><div><p className="eyebrow">Your first step</p><h2>What are you ready<br/>to explore?</h2><p>Choose your interests and join the first FR333MAN community list.</p></div>{joined ? <div className="success"><span>✓</span><h3>You’re on the inside.</h3><p>Your interests have been noted. Connect a live member list and Paystack plan to take the next payment.</p></div> : <form onSubmit={submit}><label htmlFor="name">Your name or alias</label><input id="name" required placeholder="How should we know you?"/><label htmlFor="email">Email address</label><input id="email" type="email" required placeholder="you@example.com"/><fieldset><legend>Choose your interests</legend><div className="chips">{interests.map((item) => <button type="button" className={selected.includes(item) ? 'selected' : ''} key={item} onClick={() => toggle(item)}>{item}</button>)}</div></fieldset><button className="button submit" type="submit">Join the movement <span>→</span></button><small>Free to join. No noise—only useful questions, field notes and invitations.</small></form>}</div></section>
    <footer className="shell"><a className="brand" href="#top">FR<span>333</span>MAN</a><p>FREE YOUR MIND · BUILD YOUR WORLD</p><div><a href="#question">Question</a><a href="#products">Products</a><a href="#membership">Membership</a></div><span>Johannesburg, South Africa</span></footer>
  </main>;
}
