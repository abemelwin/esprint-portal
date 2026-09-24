import { getCurrentUser } from "@/lib/session";
import { QuoteBuilderClient } from "@/modules/sales/components/QuoteBuilderClient";

export default async function SalesPage() {
  const user = (await getCurrentUser())!;

  return (
    <QuoteBuilderClient
      currentUserEmail={user.email}
      currentUserName={user.fullName}
    />
  );
}
