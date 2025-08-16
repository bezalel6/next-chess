// Optimized font loading configuration for Next.js
// Using CSS variable approach with proper fallbacks

export const digitalFontConfig = {
  fontFamily: "'Digital-7 Mono', 'Courier New', monospace",
  cssVariable: '--font-digital-7-mono',
  fontUrl: 'https://fonts.cdnfonts.com/s/17796/digital-7 (mono).woff',
};

// CSS-in-JS optimized styles for digital clock display
export const digitalClockStyles = {
  fontFamily: "var(--font-digital-7-mono, 'Courier New', monospace)",
  fontWeight: "normal",
  fontSize: "2rem",
  letterSpacing: "0.15em",
  lineHeight: 1,
  // Proper font rendering optimization (camelCase for React)
  WebkitFontSmoothing: 'antialiased' as const,
  MozOsxFontSmoothing: 'grayscale' as const,
  textRendering: 'optimizeLegibility' as const,
} as const;