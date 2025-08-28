import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Middleware to protect routes with NextAuth.js
export default withAuth(
  function middleware(req) {
    // Add any custom middleware logic here if needed
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to auth pages without token
        if (req.nextUrl.pathname.startsWith('/auth/')) {
          return true
        }
        
        // Allow access to API routes (they handle their own auth)
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return true
        }
        
        // Allow access to public pages
        if (req.nextUrl.pathname === '/' || 
            req.nextUrl.pathname === '/about' ||
            req.nextUrl.pathname === '/pricing') {
          return true
        }
        
        // For protected routes, require authentication
        return !!token
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}