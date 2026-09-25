import { redirect } from "next/navigation";

// /sales redirects to /sales/quote-builder — avoids duplicate route rendering
// the same QuoteBuilderClient on two URLs.
export default function SalesPage() {
  redirect("/sales/quote-builder");
}
