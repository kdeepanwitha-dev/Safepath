import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'SafePath – Personal Safety Route Planner',
  description: 'Multi-objective safety route planner comparing shortest, safety-only, fixed-weighted, and adaptive paths with sensitivity testing.',
  openGraph: {
    title: 'SafePath – Personal Safety Route Planner',
    description: 'Multi-objective safety route planner comparing shortest, safety-only, fixed-weighted, and adaptive paths with sensitivity testing.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SafePath – Personal Safety Route Planner',
    description: 'Multi-objective safety route planner comparing shortest, safety-only, fixed-weighted, and adaptive paths with sensitivity testing.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
