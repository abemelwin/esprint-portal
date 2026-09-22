/**
 * /checks/[id] — Check detail deep-link page.
 *
 * Renders the CheckDetailModal over a simple background.
 * Users can also open this modal by clicking a row in the All Checks table;
 * this page lets them deep-link directly to a check (e.g. from a notification).
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CheckDetailModal from "@/modules/checks/components/CheckDetailModal";
import type { CheckPerms } from "@/modules/checks/lib/permissions";

interface Props {
  params: { id: string };
}

export default function CheckDetailPage({ params }: Props) {
  const router = useRouter();

  // Load perms + user info from the server via a lightweight API call.
  const [perms, setPerms]       = useState<CheckPerms | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName]   = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setPerms({ role: json.role, branches: json.branches ?? [], aes: json.aes ?? [] });
          setUserEmail(json.email ?? "");
          setUserName(json.fullName ?? "");
        }
      })
      .catch(() => {});
  }, []);

  if (!perms) return null;

  return (
    <CheckDetailModal
      checkId={params.id}
      perms={perms}
      userEmail={userEmail}
      userName={userName}
      onClose={() => router.back()}
      onSaved={() => router.refresh()}
    />
  );
}
