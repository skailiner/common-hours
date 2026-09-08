import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://skailiner-common-hours.static.hf.space/index.html'),
  title: 'Common Hours — Free Volunteer Event Planner',
  description:
    'Turn volunteer availability and skills into a draft rota. See staffing gaps, review workloads and download a team brief. Free, browser-local and no account required.',
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
