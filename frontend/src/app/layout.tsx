import "./globals.css";
import Link from 'next/link';

export const metadata = { title: 'INFORGE — Information Intelligence', description: 'Understand. Verify. Transform. Adapt.' };

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body><header className="nav"><Link href="/" className="brand">INFORGE<span>.</span></Link><nav><Link href="/">SYSTEM</Link><Link href="/engine">ENGINE</Link><Link href="/about">ABOUT</Link><Link href="/about#team">TEAM</Link></nav><Link href="/engine" className="navCta">ENTER ENGINE <span>↗</span></Link></header>{children}</body></html>
}
