import './globals.css';

// This root layout only wraps the authenticated app's page.js routes
// (/login, /denied, /auth/callback, /console/*). The public marketing page
// at "/" is served by app/route.js as a raw Route Handler and never passes
// through this layout.
export const metadata = {
  title: 'Performance Intelligence',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
