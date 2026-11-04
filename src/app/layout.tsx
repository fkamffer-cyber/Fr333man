import type {Metadata} from 'next';
/* eslint-disable @next/next/no-sync-scripts -- Supabase runtime config must exist before client authentication initializes. */
import './globals.css';
import './extended.css';
import './comments.css';
import './sales.css';
export const metadata: Metadata = {metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3001'),title:'FR333MAN · People building together',description:'A people-first network for independent thought, practical projects and member products.',openGraph:{title:'FR333MAN · United as intended',description:'Profiles, projects, conversations and products—built by people.',type:'website',images:['/og.png']},twitter:{card:'summary_large_image',title:'FR333MAN · United as intended',description:'People building practical freedom together.',images:['/og.png']}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en-ZA"><head><script src="/api/supabase-config.js" /></head><body>{children}</body></html>}
