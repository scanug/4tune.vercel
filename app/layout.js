import { Rubik, JetBrains_Mono, Press_Start_2P } from "next/font/google";
import "./globals.css";
import BackgroundVideo from "../components/BackgroundVideo";

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

export const metadata = {
  title: "4Tune – Party Games",
  description: "Piattaforma di giochi multiplayer: GTS, Impostore e altro",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pixelFont.variable} ${pixelFont.className} antialiased`}
      >
        <BackgroundVideo />
        {children}
      </body>
    </html>
  );
}
