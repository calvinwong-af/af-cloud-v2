/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: [
      "@google-cloud/datastore",
      "google-gax",
      "firebase-admin",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "@google-cloud/datastore",
        "google-gax",
        "firebase-admin",
      ];
    }
    return config;
  },
};

export default nextConfig;
