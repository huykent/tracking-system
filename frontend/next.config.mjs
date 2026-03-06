/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    // Proxy /api/* → backend container at runtime (server-side only, NOT baked at build time)
    async rewrites() {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000'
        return [
            {
                source: '/api/:path*',
                destination: `${backendUrl}/api/:path*`,
            },
        ]
    },
}
export default nextConfig;
