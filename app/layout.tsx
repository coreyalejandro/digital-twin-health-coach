import type { ReactNode } from "react";

/**
 * Root layout (Next.js App Router target). lang + semantic structure are part
 * of the WCAG baseline (report T5).
 */
export const metadata = {
  title: "Digital Twin Health Coach",
  description: "Constitutionally-governed, neurodivergent-first wellness coach.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
