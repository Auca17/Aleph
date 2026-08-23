import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pockit — Agente financiero local",
  description: "Pockit es tu agente financiero personal impulsado por IA local. Registrá gastos con foto, voz o manual, y consultá con IA tu situación financiera.",
  openGraph: {
    title: "Pockit",
    description: "Agente financiero local para autónomos y freelancers",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${plusJakartaSans.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-[var(--font-plus-jakarta)]">{children}</body>
    </html>
  );
}
