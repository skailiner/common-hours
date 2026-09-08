import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://skailiner-common-hours.static.hf.space'),
  title: 'Common Hours — Community Rota',
  description:
    'Plan community workshop coverage with availability, skills and workload limits. Inspect constraints and keep roster data in your browser.',
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
