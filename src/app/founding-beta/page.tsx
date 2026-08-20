import { redirect } from "next/navigation";

export const metadata = {
  title: "Career Forge Pricing",
  description: "Current Career Forge beta access and optional human-review pricing."
};

export default function FoundingBetaPage() {
  // The former $49 founding-cohort page made a checkout promise that is not
  // part of the public-beta release. Keep old links useful without preserving
  // a second, contradictory offer surface.
  redirect("/pricing");
}
