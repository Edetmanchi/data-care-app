import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans, Space_Grotesk } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const grotesk = Space_Grotesk({ subsets: ["latin", "latin-ext"], variable: "--font-grotesk" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-jetbrains" });
// Full coverage for Hausa (ƙ ɗ ɓ) and Yoruba/Igbo/Efik (ẹ ọ ṣ ị ụ ṅ n̄ + tone marks).
const noto = Noto_Sans({ subsets: ["latin", "latin-ext", "vietnamese"], variable: "--font-noto" });

export const metadata: Metadata = {
  title: "Datacare Care — Find care near you",
  description:
    "Find the nearest hospital, primary health centre, midwife or pharmacy in Nigeria and get directions — no sign-up needed.",
  icons: { icon: "/datacare-mark.png" },
};

export const viewport: Viewport = {
  themeColor: "#020507",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${grotesk.variable} ${jetbrains.variable} ${noto.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
