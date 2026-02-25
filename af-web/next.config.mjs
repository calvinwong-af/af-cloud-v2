/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",   // Generates static files in /out — required for Firebase Hosting
  trailingSlash: true, // Ensures /about → /about/index.html — Firebase serves these correctly
  images: {
    unoptimized: true, // Next.js image optimisation requires a server; disabled for static export
  },
};

export default nextConfig;
