import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Cowboy Town Market — Krugersdorp', description: 'Explore Cowboy Town, find local traders, book a stall and run every part of market day.', openGraph: { title: 'Cowboy Town Market — Krugersdorp', description: 'Market day, made easier.', type: 'website' }, twitter: { card: 'summary', title: 'Cowboy Town Market', description: 'Explore the market, meet the traders and find your stall.' } };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en-ZA"><body>{children}</body></html>}
