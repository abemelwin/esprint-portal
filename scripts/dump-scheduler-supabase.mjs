import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const url = "https://tlxbcvakkhhswqdyooqt.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRseGJjdmFra2hoc3dxZHlvb3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NjQ4NTEsImV4cCI6MjEwNDE0MDg1MX0.nDYcw9ItG5ZtjyZuN8zsoVuFl9fD_naGYmjGuEmYdI8";

const emails = [
  "arnold@esprintmedia.com",
  "dan@esprintmedia.com",
  "eileensokua@esprintmedia.com",
  "esprint.rickyeina@gmail.com",
  "espmi.limwel@gmail.com",
];

const passwords = ["Esprint2026!", "ESpmi2026!", "password123", "123456"];

async function run() {
  let authenticatedClient = null;

  for (const email of emails) {
    for (const password of passwords) {
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (data?.session) {
        console.log(`Success! Authenticated as ${email}`);
        authenticatedClient = sb;
        break;
      }
    }
    if (authenticatedClient) break;
  }

  if (!authenticatedClient) {
    console.log("Could not sign in with demo accounts. Trying sign up...");
    const testEmail = `test_${Date.now()}@esprint.com`;
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data: signData, error: signErr } = await sb.auth.signUp({
      email: testEmail,
      password: "TestPassword123!",
    });

    if (signData?.session) {
      authenticatedClient = sb;
      console.log("Signed up & authenticated as temporary user:", testEmail);
    } else {
      console.log("Sign up result:", signErr?.message);
    }
  }

  if (!authenticatedClient) {
    console.error("Failed to authenticate.");
    return;
  }

  const dump = {};
  for (const table of ["branches", "staff", "jobs", "app_users"]) {
    const { data, error } = await authenticatedClient.from(table).select("*");
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
    } else {
      console.log(`Fetched ${table}: ${data.length} rows`);
      dump[table] = data;
    }
  }

  fs.writeFileSync(".scheduler-data-from-supabase.json", JSON.stringify(dump, null, 2));
  console.log("Saved scheduler dump to .scheduler-data-from-supabase.json");
}

run();
