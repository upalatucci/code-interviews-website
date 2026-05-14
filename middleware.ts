export { default } from 'next-auth/middleware';

// Protect all /admin routes — redirect unauthenticated users to /auth/signin
export const config = {
  matcher: ['/admin/:path*'],
};
