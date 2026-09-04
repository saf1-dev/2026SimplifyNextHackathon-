import Link from "next/link";
export default function NotFound() { return <div className="not-found"><p className="kicker dark"><span/> Listing unavailable</p><h1>That motorcycle couldn’t be found.</h1><p>It may have been removed from the imported dataset.</p><Link href="/" className="button dark">Return to search</Link></div>; }
