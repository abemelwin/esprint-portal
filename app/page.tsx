import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

/** Root — send logged-in users to the dashboard, others to login. */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
