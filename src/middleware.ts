import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware(_req) {
    // Add your middleware logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: ['/dashboard/:path*'],
};