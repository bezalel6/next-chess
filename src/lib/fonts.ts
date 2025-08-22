import localFont from "next/font/local";

// Self-hosted Digital-7 Mono via next/font/local. Uses CSS variable for easy application.
export const digital7Mono = localFont({
  src: [
    {
      path: "../../public/fonts/digital-7-mono.woff",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-digital-7-mono",
  display: "swap",
});
