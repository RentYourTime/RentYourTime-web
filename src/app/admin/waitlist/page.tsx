import type { Metadata } from "next";
import { AdminWaitlistClient } from "@/components/AdminWaitlistClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Waitlist admin",
  description: "Manage RentYourTime waitlist signups.",
};

export default function AdminWaitlistPage() {
  return <AdminWaitlistClient />;
}
