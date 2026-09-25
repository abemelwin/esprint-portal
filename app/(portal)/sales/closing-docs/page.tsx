import { Suspense } from "react";
import { ClosingDocsClient } from "@/modules/sales/components/ClosingDocsClient";

// ClosingDocsClient uses useSearchParams() to read ?id=<quoteId>, needs Suspense
export default function ClosingDocsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-sm text-slate-500">Loading closing documents…</div>}>
      <ClosingDocsClient />
    </Suspense>
  );
}
