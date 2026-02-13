import "./globals.css";

import Nav from "@/components/Nav";
import TransitionProvider from "@/providers/TransitionProvider";

export const metadata = {
  title: "Block Reveal Page Transition | Codegrid",
  description: "Next.js page transition, powered by next-transition-router.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <TransitionProvider>
          <Nav />
          {children}
        </TransitionProvider>
      </body>
    </html>
  );
}
