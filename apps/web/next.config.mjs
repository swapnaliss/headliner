/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@headliner/agent", "@headliner/budgets", "@headliner/slates", "@headliner/core", "@headliner/qloo"],
  // Sample rooms (M2-06) live at /s/sample-<slug> and are served by the shared page `/s/[id]` (M2-04), so the
  // security headers and the read-only view apply to them; `isSlateId` accepts the sample id shape.
  // The recorded Qloo responses are read from disk at runtime in DEMO_MODE=fixtures.
  outputFileTracingIncludes: {
    "/api/slates": ["../../fixtures/qloo/**"],
    "/api/intake": ["../../fixtures/qloo/**", "../../fixtures/agent/intake/**"],
    "/slates/[id]": ["../../fixtures/qloo/**"],
    "/slates/[id]/act/[actId]": ["../../fixtures/qloo/**"],
    "/s/[id]": ["../../fixtures/qloo/**"],
    "/s/[id]/act/[actId]": ["../../fixtures/qloo/**"],
    "/api/slates/[id]/acts/[actId]": ["../../fixtures/qloo/**"],
    "/api/slates/[id]/acts/[actId]/cities": ["../../fixtures/qloo/**"],
  },
};

export default nextConfig;
