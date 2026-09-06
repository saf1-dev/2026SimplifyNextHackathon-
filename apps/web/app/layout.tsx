import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "MotoMoto.ai — Singapore Motorcycle Intelligence", description: "Evidence-led asking-price intelligence for Singapore used motorcycles." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="shell"><nav className="nav"><Link href="/" className="brand"><img src="/brand/motomoto-logo.png" alt="" />MotoMoto.ai</Link><div className="navlinks"><Link href="/search">Search</Link><Link className="button secondary" href="/extension">Use extension</Link></div></nav></div>{children}</body></html>;
}
