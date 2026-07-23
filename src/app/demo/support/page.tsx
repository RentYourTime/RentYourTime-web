import type { Metadata } from "next";
import { SupportProjectDemo } from "@/components/demo/SupportProjectDemo";

export const metadata: Metadata = {
  title: "Support the project — demo",
  description: "A clickable mockup of the Support the project contribution flow.",
};

export default function SupportDemoPage() {
  return <SupportProjectDemo />;
}
