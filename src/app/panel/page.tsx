import type { Metadata } from "next";
import { PanelClient } from "@/components/panel/PanelClient";

export const metadata: Metadata = {
  title: "Your dashboard",
  description: "Your RentYourTime usage, rent meter, and contributions.",
};

export default function PanelPage() {
  return <PanelClient />;
}
