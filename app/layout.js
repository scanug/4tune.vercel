import { Rubik, JetBrains_Mono, Press_Start_2P, Pixelify_Sans } from "next/font/google";
import "./globals.css";
import MusicController from "../components/MusicController";
import TrophyToast from "../components/TrophyToast";
import ServerWake from "../components/ServerWake";

const geistSans = Rubik({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
});

const geistMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
});

const pixelFont = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: '400',
  display: 'swap',
});

// Pixel font più leggibile per testi brevi e descrizioni
const pixelBody = Pixelify_Sans({
  variable: "--font-pixel-body",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata = {
  title: "4Tune – Party Games",
  description: "Party game gratuiti senza registrazione: GTS, Indovina l'Anno, Impostore, Passa la Bomba e altro",
};

export const viewport = {
  themeColor: '#0a0618',
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pixelFont.variable} ${pixelBody.variable} ${pixelFont.className} antialiased`}
      >
        <div className="arcade-bg" aria-hidden="true">
          <div className="arcade-stars" />
          <div className="arcade-sun" />
          <div className="arcade-grid" />
        </div>
        {children}
        <MusicController />
        <TrophyToast />
        <ServerWake />
      </body>
    </html>
  );
}
