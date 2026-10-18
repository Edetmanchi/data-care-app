"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "./providers/auth";
import { LanguageProvider } from "./providers/language";
import { LocationProvider } from "./providers/location";
import { AuthModal } from "./AuthModal";
import { Backdrop } from "./Backdrop";
import { LocationPicker } from "./LocationPicker";
import { Navbar } from "./Navbar";
import { track } from "@/lib/client/track";

function PageViews() {
  const path = usePathname();
  useEffect(() => {
    track("page_view");
  }, [path]);
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <LocationProvider>
        <AuthProvider>
          <PageViews />
          <Backdrop />
          <Navbar />
          {children}
          <LocationPicker />
          <AuthModal />
        </AuthProvider>
      </LocationProvider>
    </LanguageProvider>
  );
}
