import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono, Young_Serif } from "next/font/google";
import { PLATFORM_URL } from "@/lib/site-url";
import "./globals.css";

// Herbarium: a warm, characterful serif for titles, a clear grotesk for reading,
// and a mono for specimen-tag labels (step numbers, colors, addresses).
const display = Young_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-young-serif",
  display: "swap",
});

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(PLATFORM_URL),
  applicationName: "BrotaSites",
  openGraph: { type: "website", locale: "pt_BR", siteName: "BrotaSites" },
  title: { default: "BrotaSites · Sete perguntas e seu site pronto", template: "%s · BrotaSites" },
  description:
    "Responda sete perguntas e veja o site do seu negócio ficar pronto enquanto escreve. Com WhatsApp, mapa e horário de funcionamento. Sem código.",
};

export const viewport: Viewport = {
  themeColor: "#f7f8f3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
