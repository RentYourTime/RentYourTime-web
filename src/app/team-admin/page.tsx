import type { Metadata } from "next";
import { TeamAdminClient } from "@/components/team-admin/TeamAdminClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team admin",
  description: "Anonymized team-level focus and adherence metrics.",
};

export default function TeamAdminPage() {
  return <TeamAdminClient />;
}
