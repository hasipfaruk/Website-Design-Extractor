/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright must never be bundled by webpack/turbopack - it needs to resolve
  // its own browser binaries and native helpers from node_modules at runtime.
  serverExternalPackages: ['playwright', 'playwright-core'],
};

export default nextConfig;
