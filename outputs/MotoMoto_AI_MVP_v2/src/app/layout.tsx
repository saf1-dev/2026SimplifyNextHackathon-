import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "ThrottleWorth — Singapore motorcycle discovery", description: "Search Singapore used motorcycles and understand comparable-market asking value." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><header className="site-header"><Link href="/" className="brand-mark"><span>TW</span>ThrottleWorth</Link><nav><a href="/#how-it-works">How it works</a><a href="/#method">Valuation method</a></nav><div className="sg-pill">SG marketplace</div></header><main>{children}</main><footer><div className="brand-mark inverse"><span>TW</span>ThrottleWorth</div><p>Comparable-market estimates use seller asking prices, not confirmed transaction prices.</p><p>Built for Singapore riders.</p></footer></body></html>;
}
