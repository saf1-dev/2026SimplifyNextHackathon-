import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing, getListings } from "@/lib/database/motorcycles";
import { explainValuation } from "@/lib/groq/explain-valuation";
import { label, money, number } from "@/lib/format";
import { assessPrice } from "@/lib/motorcycles/deal-score";
import { getValuation } from "@/lib/motorcycles/valuation-service";

export default async function BikePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [listing, listings] = await Promise.all([getListing(id), getListings()]);
  if (!listing) notFound();
  const valuation = getValuation(listing, listings);
  const difference = valuation ? listing.askingPriceSgd - valuation.estimatedMid : null;
  const percentage = valuation ? difference! / valuation.estimatedMid * 100 : null;
  const assessment = percentage === null ? null : assessPrice(percentage);
  const explanation = valuation ? await explainValuation(listing, valuation) : null;
  return <div className="detail-page">
    <Link href="/" className="back-link">← Back to search</Link>
    <section className="detail-hero">
      <div><p className="eyebrow">{listing.brand} · Class {listing.engineClass}</p><h1>{listing.model}</h1><p>{number(listing.engineCc)}cc · {listing.listingStatus ?? "Status not provided"}</p></div>
      {assessment && <span className={`assessment large ${assessment}`}>{label(assessment)}</span>}
    </section>
    <section className="valuation-panel">
      <div className="value-block listed"><span>Listed price</span><strong>{money(listing.askingPriceSgd)}</strong><small>Seller asking price</small></div>
      <div className="value-block estimate"><span>Estimated market range</span><strong>{valuation ? `${money(valuation.estimatedLow)}–${money(valuation.estimatedHigh).replace("$", "")}` : "Unavailable"}</strong><small>{valuation ? `Midpoint ${money(valuation.estimatedMid)}` : "Not enough comparable data"}</small></div>
      <div className="value-block"><span>Difference</span><strong>{difference === null ? "—" : `${difference > 0 ? "+" : "−"}${money(Math.abs(difference))}`}</strong><small>{percentage === null ? "Not available" : `${Math.abs(percentage).toFixed(1)}% ${percentage > 0 ? "above" : "below"} midpoint`}</small></div>
    </section>
    {explanation && <section className="explanation"><div className="quote-mark">“</div><p>{explanation}</p></section>}
    <div className="detail-columns">
      <section className="detail-card"><h2>Listing details</h2><dl className="details-list">
        <div><dt>Mileage</dt><dd>{listing.mileageKm === null ? "Not provided" : `${number(listing.mileageKm)} km`}</dd></div>
        <div><dt>COE remaining</dt><dd>{listing.coeRemainingYears === null ? "Not provided" : `${number(listing.coeRemainingYears)} years`}</dd></div>
        <div><dt>Age</dt><dd>{listing.ageYears === null ? "Not provided" : `${number(listing.ageYears)} years`}</dd></div>
        <div><dt>Owners</dt><dd>{listing.numberOfOwners ?? "Not provided"}</dd></div>
        <div><dt>Condition</dt><dd>{listing.conditionScore === null ? "Not provided" : `${number(listing.conditionScore)} / 5`}</dd></div>
        <div><dt>Location</dt><dd>{listing.location ?? "Not provided"}</dd></div>
      </dl>{listing.redFlags && !/^(na|n\/a)$/i.test(listing.redFlags) && <div className="warning"><b>Listing check</b><p>{listing.redFlags}</p></div>}<a className="button dark full" href={listing.listingUrl} target="_blank" rel="noreferrer">View original listing ↗</a></section>
      <section className="detail-card"><h2>Evidence quality</h2>{valuation ? <><div className="confidence-row"><strong className="capitalize">{valuation.confidence}</strong><span>valuation confidence</span></div><dl className="details-list compact"><div><dt>Comparable bikes</dt><dd>{valuation.comparableCount}</dd></div><div><dt>Search level</dt><dd>{valuation.searchLevel} of 8</dd></div><div><dt>Average similarity</dt><dd>{Math.round(valuation.averageSimilarity * 100)}%</dd></div><div><dt>Evidence completeness</dt><dd>{listing.evidenceCompleteness === null ? "Not provided" : `${listing.evidenceCompleteness} / 5`}</dd></div></dl><p className="method-copy">{valuation.filtersRelaxed.length ? `The comparable search broadened by relaxing ${valuation.filtersRelaxed.map(label).join(", ")}.` : "The estimate used the most specific comparable criteria without relaxing any fields."}</p></> : <p>Not enough comparable listing data to provide a reliable valuation.</p>}</section>
    </div>
    {valuation && <section className="comparables"><div className="section-heading"><div><p className="kicker dark"><span/> Valuation evidence</p><h2>Comparable motorcycles used</h2></div><p>Seller asking prices · target listing excluded</p></div><div className="table-wrap"><table><thead><tr><th>Motorcycle</th><th>Price</th><th>Mileage</th><th>COE</th><th>Age</th><th>Condition</th><th>Similarity</th></tr></thead><tbody>{valuation.comparables.map((item) => <tr key={item.id}><td><a href={item.listingUrl} target="_blank" rel="noreferrer"><b>{item.brand} {item.model}</b><small>Class {item.engineClass} · {item.engineCc}cc</small></a></td><td>{money(item.askingPriceSgd)}</td><td>{item.mileageKm === null ? "Not provided" : `${number(item.mileageKm)} km`}</td><td>{item.coeRemainingYears === null ? "Not provided" : `${number(item.coeRemainingYears)} yrs`}</td><td>{item.ageYears === null ? "Not provided" : `${number(item.ageYears)} yrs`}</td><td>{item.conditionScore === null ? "Not provided" : `${number(item.conditionScore)} / 5`}</td><td><span className="similarity">{Math.round(item.similarity * 100)}%</span></td></tr>)}</tbody></table></div><p className="fine-print">Estimated comparable-market values are based on advertised asking prices. They are not confirmed transaction prices or guarantees of sale value.</p></section>}
  </div>;
}
