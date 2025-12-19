import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Ensures a user is authenticated.
 * Redirects to /login if not.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }
  
  return { user, supabase };
}

/**
 * Ensures the user has 'admin' role.
 * Redirects to home if authenticated but not authorized.
 */
export async function requireAdmin() {
  const { user, supabase } = await requireUser();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  return { user, supabase };
}

/**
 * Ensures the user has 'stacker' OR 'admin' role.
 * Returns the full profile needed for the dashboard.
 */
export async function requireStacker() {
  const { user, supabase } = await requireUser();

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, username, display_name, avatar_url")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "stacker" && profile?.role !== "admin") {
    redirect("/");
  }

  return { user, profile };
}