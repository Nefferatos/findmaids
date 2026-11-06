/**
 * Tailwind CSS v4 is wired in through its official PostCSS plugin.
 * Next.js (Turbopack) loads this configuration automatically, so no custom
 * Turbopack loader rule is needed in next.config.ts.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
