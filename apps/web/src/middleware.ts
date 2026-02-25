import { authkit, applyResponseHeaders, partitionAuthkitHeaders } from '@workos-inc/authkit-nextjs';
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PAGE_PREFIXES = ['/dashboard', '/settings', '/account'];
const PROTECTED_API_PREFIXES = ['/api/generate'];

const matchesPrefix = (pathname: string, prefixes: string[]): boolean =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const getReturnPathname = (request: NextRequest): string => {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  return search ? `${pathname}${search}` : pathname;
};

export default async function middleware(request: NextRequest) {
  const redirectUri =
    process.env['WORKOS_REDIRECT_URI'] ?? process.env['NEXT_PUBLIC_WORKOS_REDIRECT_URI'];
  const { session, headers: authkitHeaders } = await authkit(request, {
    redirectUri,
  });
  const { requestHeaders, responseHeaders } = partitionAuthkitHeaders(request, authkitHeaders);
  const pathname = request.nextUrl.pathname;

  const isProtectedPage = matchesPrefix(pathname, PROTECTED_PAGE_PREFIXES);
  const isProtectedApi = matchesPrefix(pathname, PROTECTED_API_PREFIXES);

  if (!session?.user && isProtectedPage) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', getReturnPathname(request));
    return applyResponseHeaders(NextResponse.redirect(signInUrl), responseHeaders);
  }

  if (!session?.user && isProtectedApi) {
    const signInPath = `/sign-in?redirect=${encodeURIComponent(getReturnPathname(request))}`;
    const response = NextResponse.json(
      {
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
        signInPath,
      },
      { status: 401 },
    );

    return applyResponseHeaders(response, responseHeaders);
  }

  return applyResponseHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    responseHeaders,
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
