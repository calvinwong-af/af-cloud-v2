/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@google-cloud/datastore", "google-gax"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "@google-cloud/datastore",
        "google-gax",
      ];
    }
    return config;
  },
};

export default nextConfig;
