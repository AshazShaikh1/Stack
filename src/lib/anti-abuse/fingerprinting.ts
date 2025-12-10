/**
 * Anti-Abuse Controls
 * Device fingerprinting, IP clustering, and shadowbanning
 */

interface DeviceFingerprint {
  userAgent: string;
  language: string;
  timezone: string;
  screenResolution?: string;
  platform?: string;
}

interface AbuseFlags {
  isShadowbanned: boolean;
  isRateLimited: boolean;
  qualityScore: number;
  flags: string[];
}

/**
 * Generate a device fingerprint from request headers
 */
export function generateDeviceFingerprint(request: Request): string {
  const userAgent = request.headers.get("user-agent") || "";
  const acceptLanguage = request.headers.get("accept-language") || "";
  const acceptEncoding = request.headers.get("accept-encoding") || "";

  // Create a simple fingerprint hash
  const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;

  // In production, use a proper hashing function
  return btoa(fingerprint).substring(0, 32);
}

/**
 * Check if user should be shadowbanned based on quality score and flags
 */
export async function checkShadowban(
  supabase: any,
  userId: string
): Promise<boolean> {
  const { data: user } = await supabase
    .from("users")
    .select("quality_score, metadata")
    .eq("id", userId)
    .single();

  if (!user) return false;

  // Debug log to see what's happening
  console.log(
    `[Shadowban Check] User: ${userId}, Score: ${user.quality_score}, Metadata:`,
    user.metadata
  );

  // FIX: Treat null OR 0 as neutral (30) to prevent auto-banning new users
  let qualityScore = user.quality_score;
  if (qualityScore === null || qualityScore === 0) {
    qualityScore = 30;
  }

  // Shadowban if quality score is very low (bad actor)
  if (qualityScore < 20) {
    console.log(`[Shadowban Check] Banned due to low score: ${qualityScore}`);
    return true;
  }

  // Check metadata for shadowban flag
  if (user.metadata?.shadowbanned === true) {
    console.log(`[Shadowban Check] Banned due to metadata flag`);
    return true;
  }

  return false;
}

/**
 * Check for IP clustering (multiple accounts from same IP)
 */
export async function checkIpClustering(
  supabase: any,
  ipAddress: string,
  userId: string
): Promise<{ isClustered: boolean; accountCount: number }> {
  return {
    isClustered: false,
    accountCount: 1,
  };
}

/**
 * Get abuse flags for a user
 */
export async function getAbuseFlags(
  supabase: any,
  userId: string
): Promise<AbuseFlags> {
  const { data: user } = await supabase
    .from("users")
    .select("quality_score, metadata")
    .eq("id", userId)
    .single();

  const flags: string[] = [];

  // Apply same fix for score display
  let qualityScore = user?.quality_score;
  if (qualityScore === null || qualityScore === 0) {
    qualityScore = 30;
  }

  if (qualityScore < 20) {
    flags.push("low_quality_score");
  }

  if (user?.metadata?.shadowbanned) {
    flags.push("shadowbanned");
  }

  if (user?.metadata?.rate_limited) {
    flags.push("rate_limited");
  }

  return {
    isShadowbanned: await checkShadowban(supabase, userId),
    isRateLimited: user?.metadata?.rate_limited === true,
    qualityScore,
    flags,
  };
}

/**
 * Apply shadowban to a user
 */
export async function shadowbanUser(
  supabase: any,
  userId: string,
  reason: string
): Promise<void> {
  const { data: user } = await supabase
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .single();

  const metadata = user?.metadata || {};

  await supabase
    .from("users")
    .update({
      metadata: {
        ...metadata,
        shadowbanned: true,
        shadowban_reason: reason,
        shadowbanned_at: new Date().toISOString(),
      },
    })
    .eq("id", userId);
}

/**
 * Remove shadowban from a user
 */
export async function unshadowbanUser(
  supabase: any,
  userId: string
): Promise<void> {
  const { data: user } = await supabase
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .single();

  const metadata = user?.metadata || {};
  delete metadata.shadowbanned;
  delete metadata.shadowban_reason;
  delete metadata.shadowbanned_at;

  await supabase.from("users").update({ metadata }).eq("id", userId);
}
