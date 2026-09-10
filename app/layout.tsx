import type {Metadata} from 'next';
import './globals.css';
export const metadata: Metadata = {title:'FR333MAN · People building together',description:'A people-first network for independent thought, practical projects and member products.',openGraph:{title:'FR333MAN · United as intended',description:'Profiles, projects, conversations and products—built by people.',type:'website',images:['/og.png']},twitter:{card:'summary_large_image',title:'FR333MAN · United as intended',description:'People building practical freedom together.',images:['/og.png']}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en-ZA"><body>{children}</body></html>}
