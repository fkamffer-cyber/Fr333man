import { notFound } from "next/navigation";
import Link from "next/link";
import { products } from "@/app/platform-data";
import {findPublicProduct} from "@/lib/public-directory";

export default async function ProductListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await findPublicProduct(id) ?? products.find((item) => item.id === id);
  if (!product) notFound();

  return (
    <main className="product-listing">
      <nav><Link href="/">FR<span>333</span>MAN</Link><Link href="/?view=Marketplace">Marketplace</Link></nav>
      <article>
        <div className="listing-visual">{product.images?.[0]?.url?<img src={product.images[0].url} alt={product.images[0].alt}/>:product.mark}</div>
        <section className="listing-copy">
          <small>{product.category.toUpperCase()} · PUBLIC PRODUCT LISTING</small>
          <h1>{product.name}</h1><strong>{product.price}</strong><p>{product.description}</p>
          <dl><div><dt>Seller</dt><dd>{product.owner}</dd></div><div><dt>Region</dt><dd>{product.region || (product.ownerHandle === "@fr333man" ? "Randburg" : "See seller profile")}</dd></div><div><dt>Availability</dt><dd>{product.stock===undefined ? "Confirm with seller" : `${product.stock} available`}</dd></div><div><dt>Membership</dt><dd>{product.membershipEligible ? "Eligible after monthly catalogue confirmation" : "Purchased separately"}</dd></div></dl>
          <Link className="primary" href={`/?view=Marketplace&product=${encodeURIComponent(product.id)}`}>View in marketplace</Link>
          <footer>Confirm availability, condition, fulfilment and seller identity before payment. The named seller is responsible for the product and transaction.</footer>
        </section>
      </article>
    </main>
  );
}
