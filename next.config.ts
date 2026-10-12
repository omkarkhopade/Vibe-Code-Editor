import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/template/*": ["./vibecode-starters/{react-ts,nextjs,express-simple,vue,hono-nodejs-starter,angular}/**/*"] },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  images:{
    remotePatterns:[
      {
        protocol:"https",
        hostname:"lh3.googleusercontent.com",
        port:'',
        pathname:"/**"
      }
      , { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" }
    ]
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  reactStrictMode:false
};

export default nextConfig;
