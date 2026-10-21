import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valtu 3D · Gestión",
  description: "Tu taller en orden: pedidos, impresión, materiales y cobros.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
