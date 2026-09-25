import type { Metadata } from "next";
import "./globals.css";
import NetworkStatusNotifier from "@/components/network-status-notifier";

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
      <body>
        <NetworkStatusNotifier />
        {children}
      </body>
    </html>
  );
}

