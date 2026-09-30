import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "./nav-bar";

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
      appearance={{
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
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <NavBar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
