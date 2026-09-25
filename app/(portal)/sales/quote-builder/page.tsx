import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { QuoteBuilderClient } from "@/modules/sales/components/QuoteBuilderClient";

// QuoteBuilderClient uses useSearchParams() which needs Suspense
export default async function QuoteBuilderPage() {
  const user = (await getCurrentUser())!;

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-sm text-slate-500">Loading…</div>}>
      <QuoteBuilderClient
        currentUserEmail={user.email}
        currentUserName={user.fullName}
      />
    </Suspense>
  );
}
