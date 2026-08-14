const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

function getPayloadPreviewOrigin() {
  try {
    return process.env.PAYLOAD_PUBLIC_URL
      ? new URL(process.env.PAYLOAD_PUBLIC_URL).origin
      : null
  } catch {
    return null
  }
}

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  async headers() {
    const payloadOrigin = getPayloadPreviewOrigin()
    const localPreviewOrigins =
      process.env.NODE_ENV === "production"
        ? []
        : ["http://localhost:3000", "http://localhost:3001"]
    const frameAncestors = ["'self'", payloadOrigin, ...localPreviewOrigins]
      .filter(Boolean)
      .join(" ")

    return [
      {
        source: "/:countryCode/account/claims",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors};`,
          },
        ],
      },
    ]
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.core.windows.net",
      },
    ],
  },
}

module.exports = nextConfig
