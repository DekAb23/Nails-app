import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import ColorSchemeMeta from "./components/ColorSchemeMeta";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// --- Metadata מותאם אישית לאדר אברג'ל מנצור ---
export const metadata: Metadata = {
  title: "Adar Cosmetics | בוטיק יופי וטיפוח",
  description: "קביעת תורים אונליין לאדר אברג'ל מנצור",
  other: {
    "color-scheme": "light only",
  },
  openGraph: {
    title: "Adar Cosmetics",
    description: "קביעת תורים אונליין לאדר אברג'ל מנצור",
    url: "https://nails-app-omega.vercel.app",
    siteName: "Adar Cosmetics",
    locale: "he_IL",
    type: "website",
    // הוספת הנתיב המפורש לתמונה
    images: [
      {
        url: 'https://nails-app-omega.vercel.app/opengraph-image.png', 
        width: 1200,
        height: 630,
        alt: 'Adar Cosmetics',
      },
    ],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" style={{ colorScheme: 'light only' }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased`}
      >
        <ColorSchemeMeta />
        {children}
      </body>
    </html>
  );
}