import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const error = requestUrl.searchParams.get("error");
    const errorDescription = requestUrl.searchParams.get("error_description");
    const next = requestUrl.searchParams.get("next") || "/";

    // 1. Handle OAuth errors from the provider
    if (error) {
      console.error("OAuth error from provider:", error, errorDescription);
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", errorDescription || error);
      return NextResponse.redirect(loginUrl);
    }

    if (!code) {
      console.error("No code parameter found in OAuth callback");
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "no_code");
      return NextResponse.redirect(loginUrl);
    }

    // 2. Prepare the response (we will set cookies on this)
    const redirectUrl = new URL(next, request.url);
    const supabaseResponse = NextResponse.redirect(redirectUrl);

    // 3. Create Supabase Client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              supabaseResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // 4. Exchange the code for a session
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Supabase Code Exchange Error:", exchangeError);
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "auth_exchange_failed");
      loginUrl.searchParams.set("details", exchangeError.message);
      return NextResponse.redirect(loginUrl);
    }

    if (data?.session) {
      // Success! The session cookies are now set on supabaseResponse
      return supabaseResponse;
    }

    // Fallback if no session
    console.error("No session retrieved after code exchange");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "no_session_created");
    return NextResponse.redirect(loginUrl);
  } catch (err) {
    console.error("Unexpected error in /auth/callback:", err);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "server_error");
    return NextResponse.redirect(loginUrl);
  }
}
