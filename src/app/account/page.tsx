import type { Metadata } from "next";
import { AccountClient } from "@/components/AccountClient";

export const metadata: Metadata = {
  title: "Your account",
  description: "Create or access your RentYourTime account and manage Pro access.",
};

export default function AccountPage() {
  return <AccountClient />;
}
