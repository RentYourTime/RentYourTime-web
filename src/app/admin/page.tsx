import type { Metadata } from "next";
import { AdminClient } from "@/components/admin/AdminClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  description: "Platform overview, user accounts, subscriptions, and system controls.",
};

export default function AdminPage() {
  return <AdminClient />;
}
