import type { Metadata } from "next";
import { DemoApp } from "@/components/demo/DemoApp";

export const metadata: Metadata = {
  title: "App demo",
  description: "Interactive RentYourTime product demo.",
};

export default function DemoPage() {
  return <DemoApp />;
}
