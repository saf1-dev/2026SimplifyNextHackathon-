"use client";

import { FormEvent, useState } from "react";
import { BikeCard } from "./BikeCard";
import type { HardSearchFilters, SearchIntent, SearchResult } from "@/lib/motorcycles/types";

type SearchResponse = { interpretedRequest: SearchIntent; resultCount: number; results: SearchResult[] };
const examples = ["Class 2A bike under $8k", "Best value Yamaha for commuting", "Class 2B bike with at least 5 years COE", "Reliable Japanese bike below $6k"];

export function SearchExperience() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setFilter = (key: string, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  async function submit(event?: FormEvent, selectedQuery?: string) {
    event?.preventDefault();
    const searchQuery = selectedQuery ?? query;
    if (selectedQuery) setQuery(selectedQuery);
    setLoading(true); setError(null);
    const numericKeys = ["maxPriceSgd", "minCoeYears", "maxMileageKm", "minEngineCc", "maxEngineCc", "minAgeYears", "maxAgeYears"];
    const manual = Object.fromEntries(Object.entries(filters).filter(([, value]) => value).map(([key, value]) => [key, numericKeys.includes(key) ? Number(value) : key === "brands" ? [value] : value])) as HardSearchFilters;
    try {
      const result = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: searchQuery, filters: manual }) });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error ?? "Search failed.");
      setResponse(body);
      requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Search failed."); }
    finally { setLoading(false); }
  }

  return <>
    <section className="hero">
      <div className="hero-glow one"/><div className="hero-glow two"/>
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="kicker"><span/> Singapore used motorcycles</p>
          <h1>Find the right bike.<br/><em>Know what it’s worth.</em></h1>
          <p className="subhead">Search real listings and compare asking prices against similar bikes before you negotiate.</p>
        </div>
        <form className="search-shell" onSubmit={submit}>
          <label htmlFor="bike-search">Describe your ideal motorcycle</label>
          <div className="search-row">
            <input id="bike-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tell me what motorcycle you're looking for…" />
            <button disabled={loading} className="search-button">{loading ? "Searching…" : "Search bikes"}<span>→</span></button>
          </div>
          <div className="example-prompts">{examples.map((example) => <button type="button" key={example} onClick={() => submit(undefined, example)}>{example}</button>)}</div>
          <details className="filters">
            <summary><span>Refine with filters</span><small>Manual choices override the search text</small></summary>
            <div className="filter-grid">
              <label>Engine class<select value={filters.engineClass ?? ""} onChange={(e) => setFilter("engineClass", e.target.value)}><option value="">Any</option><option>2B</option><option>2A</option><option>2</option></select></label>
              <label>Brand<select value={filters.brands ?? ""} onChange={(e) => setFilter("brands", e.target.value)}><option value="">Any</option>{["Honda","Yamaha","Suzuki","Kawasaki","KTM","BMW","CFMoto","Royal Enfield","Triumph"].map((b)=><option key={b}>{b}</option>)}</select></label>
              <label>Max price<input type="number" min="0" placeholder="S$8,000" value={filters.maxPriceSgd ?? ""} onChange={(e) => setFilter("maxPriceSgd", e.target.value)}/></label>
              <label>Min COE years<input type="number" min="0" step="0.5" placeholder="2" value={filters.minCoeYears ?? ""} onChange={(e) => setFilter("minCoeYears", e.target.value)}/></label>
              <label>Max mileage<input type="number" min="0" placeholder="80,000 km" value={filters.maxMileageKm ?? ""} onChange={(e) => setFilter("maxMileageKm", e.target.value)}/></label>
              <label>CC range<div className="split-input"><input type="number" placeholder="Min" value={filters.minEngineCc ?? ""} onChange={(e) => setFilter("minEngineCc", e.target.value)}/><input type="number" placeholder="Max" value={filters.maxEngineCc ?? ""} onChange={(e) => setFilter("maxEngineCc", e.target.value)}/></div></label>
              <label>Age range<div className="split-input"><input type="number" placeholder="Min" value={filters.minAgeYears ?? ""} onChange={(e) => setFilter("minAgeYears", e.target.value)}/><input type="number" placeholder="Max" value={filters.maxAgeYears ?? ""} onChange={(e) => setFilter("maxAgeYears", e.target.value)}/></div></label>
            </div>
          </details>
        </form>
        <div className="trust-row"><span>✓ Real listing data</span><span>✓ Comparable-based estimates</span><span>✓ Asking prices, not sale prices</span></div>
      </div>
    </section>

    {loading && <section className="loading-state"><div className="spinner"/><div><strong>Understanding your search…</strong><p>Finding matching motorcycles and comparing similar listings.</p></div></section>}
    {error && <section className="error-state">{error} You can adjust the filters and try again.</section>}
    {response && !loading && <section className="results-section" id="results">
      <div className="results-heading"><div><p className="kicker dark"><span/> Search results</p><h2>{response.resultCount ? `${response.resultCount} bikes worth a closer look` : "No exact matches yet"}</h2><p>{response.interpretedRequest.summary}</p></div><span className="source-badge">Interpreted by {response.interpretedRequest.source === "groq" ? "Groq" : "safe fallback"}</span></div>
      {response.results.length ? <div className="results-grid">{response.results.map((result) => <BikeCard key={result.listing.id} result={result}/>)}</div> : <div className="empty-state"><h3>No motorcycles matched all of those requirements.</h3><p>Try increasing your budget or relaxing mileage and COE filters.</p></div>}
    </section>}
  </>;
}
