import Link from "next/link";
import { label, money, number } from "@/lib/format";
import type { SearchResult } from "@/lib/motorcycles/types";

export function BikeCard({ result }: { result: SearchResult }) {
  const { listing, valuation } = result;
  const difference = result.priceDifference;
  return <article className="bike-card">
    <div className="card-topline">
      <span className="class-pill">Class {listing.engineClass}</span>
      {result.priceAssessment && <span className={`assessment ${result.priceAssessment}`}>{label(result.priceAssessment)}</span>}
    </div>
    <div className="card-heading">
      <div><p className="eyebrow">{listing.brand}</p><h3>{listing.model}</h3><p className="muted">{number(listing.engineCc)}cc</p></div>
      <div className="deal-score"><strong>{result.dealScore}</strong><span>Deal<br/>Score</span></div>
    </div>
    <div className="price-grid">
      <div><span>Listed price</span><strong>{money(listing.askingPriceSgd)}</strong></div>
      <div><span>Estimated range</span><strong>{valuation ? `${money(valuation.estimatedLow)}–${money(valuation.estimatedHigh).replace("$", "")}` : "Unavailable"}</strong></div>
    </div>
    <p className="difference">{difference === null ? "Not enough comparable evidence" : `${money(Math.abs(difference))} ${difference <= 0 ? "below" : "above"} estimated midpoint`}</p>
    <dl className="spec-grid">
      <div><dt>Mileage</dt><dd>{listing.mileageKm === null ? "Not provided" : `${number(listing.mileageKm)} km`}</dd></div>
      <div><dt>COE remaining</dt><dd>{listing.coeRemainingYears === null ? "Not provided" : `${number(listing.coeRemainingYears)} yrs`}</dd></div>
      <div><dt>Age</dt><dd>{listing.ageYears === null ? "Not provided" : `${number(listing.ageYears)} yrs`}</dd></div>
      <div><dt>Confidence</dt><dd className="capitalize">{valuation?.confidence ?? "Unavailable"}</dd></div>
    </dl>
    {listing.redFlags && !/^(n\/a|na)$/i.test(listing.redFlags) && <p className="red-flag">Check: {listing.redFlags}</p>}
    <div className="card-actions">
      <Link className="button dark" href={`/bikes/${listing.id}`}>View valuation</Link>
      <a className="button light" href={listing.listingUrl} target="_blank" rel="noreferrer">View listing ↗</a>
    </div>
  </article>;
}
