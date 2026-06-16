import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase session refresh — REQUIRED for the cookie-based SSR auth setup.
 *
 * Server Components cannot write cookies, so they can't persist a refreshed
 * access token. Without this middleware, once the access token expires (~1h)
 * every authenticated request has multiple server clients (Header, page, libs)
 * concurrently trying to refresh with the same refresh token. Supabase rotates
 * refresh tokens on use, so all-but-one fail and retry, and nothing can persist
 * the new token — producing multi-second to multi-minute hangs, dead RSC
 * navigations (links that "don't work" until a full page load), and slow
 * authenticated pages (/admin, partner submit, etc.).
 *
 * Running getUser() here refreshes the token exactly once per request and
 * writes the new cookies onto the response, so downstream Server Components see
 * a fresh, valid session and never race on a refresh.
 *
 * Official pattern: https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getUser — it
  // refreshes the session and must be the first thing that touches auth.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     * - static assets (_next/static, _next/image, favicon, fonts, images)
     * - the Stripe webhook + cron routes (authenticated by signature/secret,
     *   never by user cookies — no session to refresh, and we must not touch
     *   the raw webhook request)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|txt|xml)$).*)",
  ],
};
