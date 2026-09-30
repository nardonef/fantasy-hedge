import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { hedgeLocalization } from "@/lib/clerk-localization";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "fantasy·hedge",
  description: "Hedge your fantasy football roster with prediction markets.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      localization={hedgeLocalization}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      appearance={{
        cssLayerName: "clerk",
        variables: {
          colorPrimary: "#f2b441",
          colorBackground: "#0a0a0b",
          colorForeground: "#fafafa",
          colorInput: "#0e0e16",
          colorInputForeground: "#fafafa",
          borderRadius: "9px",
          fontFamily: "Geist",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
