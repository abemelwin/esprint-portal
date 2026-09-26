import { createClient } from "@supabase/supabase-js";

const url = "https://tlxbcvakkhhswqdyooqt.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRseGJjdmFra2hoc3dxZHlvb3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NjQ4NTEsImV4cCI6MjEwNDE0MDg1MX0.nDYcw9ItG5ZtjyZuN8zsoVuFl9fD_naGYmjGuEmYdI8";

const sb = createClient(url, key, { auth: { persistSession: false } });

async function run() {
  console.log("Signing in to Supabase...");
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
    email: "arnold@esprintmedia.com",
    password: "Esprint2026!",
  });

  if (authErr) {
    console.error("Auth failed:", authErr.message);
    return;
  }

  console.log("Authenticated successfully as:", auth.user.email);

  for (const table of ["branches", "staff", "jobs", "app_users"]) {
    const { data, error } = await sb.from(table).select("*");
    if (error) {
      console.error(`Error loading ${table}:`, error.message);
    } else {
      console.log(`Table '${table}': ${data.length} rows`);
      if (data.length > 0) {
        console.log(`Sample '${table}':`, JSON.stringify(data[0]));
      }
    }
  }
}

run();
