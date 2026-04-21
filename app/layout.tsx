import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JAC Live Pulse",
  description:
    "Presentacion interactiva con QR, nombres y resultados en tiempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning={true}>
      <body>{children}</body>
    </html>
  );
}
