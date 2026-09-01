/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // playwright-core + @sparticuz/chromium ship native binaries — must not
    // be webpack-bundled, just traced onto the serverless function as-is.
    serverComponentsExternalPackages: ['playwright-core', '@sparticuz/chromium'],
    // The chromium binary's own package dir must be force-included: nft's
    // static analysis doesn't see @sparticuz/chromium's runtime brotli-
    // extraction, so without this the deployed function ships an
    // incomplete package (main binary present, but companion .so files
    // like libnss3.so missing) — browserType.launch() fails at runtime.
    outputFileTracingIncludes: {
      '/api/**': [
        './content/**',
        './lib/contract-template/**',
        './node_modules/@sparticuz/chromium/**',
      ],
      '/console/pricing': ['./lib/pricing-native/**'],
    },
  },
};
module.exports = nextConfig;
