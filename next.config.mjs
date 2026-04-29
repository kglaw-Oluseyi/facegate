/** @type {import('next').NextConfig} */
const nextConfig = {
  output: undefined,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
