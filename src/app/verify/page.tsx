import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyClient } from "@/components/VerifyClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Confirm your email address to finish setting up your RentYourTime account.",
};

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyClient />
    </Suspense>
  );
}
