import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelClient } from "@/components/panel/PanelClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your dashboard",
  description: "Your RentYourTime usage, rent meter, and contributions.",
};

export default function PanelPage() {
  return (
    <Suspense fallback={null}>
      <PanelClient />
    </Suspense>
  );
}
