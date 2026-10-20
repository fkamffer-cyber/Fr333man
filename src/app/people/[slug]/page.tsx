/* eslint-disable @next/next/no-html-link-for-pages -- hard navigation intentionally restores the main community workspace */
import type {Metadata} from 'next';
import {people,products,projects} from '@/app/platform-data';
import {findPublicPerson,productsForPerson} from '@/lib/public-directory';

function findDemoPerson(slug:string){return people.find(person=>person.handle.slice(1)===decodeURIComponent(slug))}
async function resolvePerson(slug:string){return await findPublicPerson(decodeURIComponent(slug))??findDemoPerson(slug)}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const person=await resolvePerson(slug);return person?{title:`${person.name} · FR333MAN`,description:person.bio,openGraph:{title:`${person.name} · FR333MAN`,description:person.bio,images:[]},twitter:{card:'summary',title:person.name,description:person.bio,images:[]}}:{title:'People · FR333MAN'}}
export default async function PersonPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const person=await resolvePerson(slug);
  if(!person)return <main className="public-person missing"><a href="/">← FR333MAN</a><h1>This people page is not available.</h1></main>;
  const databaseUserId='userId' in person&&typeof person.userId==='string'?person.userId:null;const ownProducts=databaseUserId?await productsForPerson(databaseUserId):products.filter(product=>product.ownerHandle===person.handle);
  return <main className="public-person" style={{'--person':person.color} as React.CSSProperties}>
    <nav><a href="/">FR<span>333</span>MAN</a><div><a href="/?view=People">People</a><a href="/?view=Projects">Projects</a><a href="/?view=Marketplace">Marketplace</a></div></nav>
    <header><div className="public-avatar">{person.initials}</div><span className="people-badge">PEOPLE · {person.status}</span><h1>{person.name}</h1><p>{person.handle} · {person.region}</p><div className="public-actions"><a href={`mailto:?subject=${encodeURIComponent(`Connect with ${person.name} on FR333MAN`)}`}>Message</a>{databaseUserId?<a className="primary" href={`/shops/${person.handle.slice(1)}`}>Visit their shop</a>:<a className="primary" href="/?view=Marketplace">Support their work</a>}</div></header>
    <section className="public-body" id="about"><article><p>ABOUT</p><h2>{person.bio}</h2><div className="skill-row">{person.skills.map(skill=><b key={skill}>{skill}</b>)}</div></article><aside><dl><div><dt>Projects</dt><dd>{person.projects}</dd></div><div><dt>Region</dt><dd>{person.region}</dd></div><div><dt>Trust status</dt><dd>{person.status}</dd></div></dl></aside></section>
    <section className="public-work"><div><p>BUILDING WITH PEOPLE</p><h2>Current projects</h2></div><div className="public-grid">{projects.slice(0,2).map(project=><article key={project.id}><i style={{background:project.accent}}>{project.icon}</i><span><b>{project.title}</b><small>{project.summary}</small></span></article>)}</div></section>
    <section className="public-work"><div><p>MEMBER MARKETPLACE</p><h2>Products and offers</h2></div>{ownProducts.length?<div className="public-grid">{ownProducts.map(product=><article key={product.id}><i>{product.mark}</i><span><b>{product.name}</b><small>{product.description}</small><em>{product.price}</em></span></article>)}</div>:<div className="empty-work"><b>No approved products yet.</b><span>{databaseUserId?'Visit this member’s shop as new products complete review.':'This preview profile is not connected to a live member shop.'}</span></div>}</section>
    <footer>Human by nature · United as intended · <a href="/">fr333man.co.za</a></footer>
  </main>;
}
