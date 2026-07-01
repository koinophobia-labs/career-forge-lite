"use client";

import { inject } from "@vercel/analytics";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackLandingVisit } from "@/lib/analytics";

export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    inject({
      mode: process.env.NODE_ENV === "development" ? "development" : "production",
    });
  }, []);

  useEffect(() => {
    if (pathname === "/") {
      trackLandingVisit();
    }
  }, [pathname]);

  return null;
}
