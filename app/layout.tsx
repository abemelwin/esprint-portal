import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ES Print Media Inc. Portal",
  description: "Unified Business Operations Portal for ES Print Media Inc.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
