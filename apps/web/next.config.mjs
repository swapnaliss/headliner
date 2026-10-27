/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@headliner/slates", "@headliner/core", "@headliner/qloo"],
  // The recorded Qloo responses are read from disk at runtime in DEMO_MODE=fixtures.
  outputFileTracingIncludes: {
    "/api/slates": ["../../fixtures/qloo/**"],
    "/slates/[id]": ["../../fixtures/qloo/**"],
    "/slates/[id]/act/[actId]": ["../../fixtures/qloo/**"],
    "/api/slates/[id]/acts/[actId]": ["../../fixtures/qloo/**"],
    "/api/slates/[id]/acts/[actId]/cities": ["../../fixtures/qloo/**"],
  },
};

export default nextConfig;
