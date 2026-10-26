/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@headliner/slates", "@headliner/core", "@headliner/qloo"],
  // The recorded Qloo responses are read from disk at runtime in DEMO_MODE=fixtures.
  outputFileTracingIncludes: { "/api/slates": ["../../fixtures/qloo/**"], "/slates/[id]": ["../../fixtures/qloo/**"] },
};

export default nextConfig;
