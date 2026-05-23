/** Allow only same-app relative paths for post-login redirects. */
export function safeRedirectPath(path: string | null | undefined, fallback = "/app"): string {
  if (!path || typeof path !== "string") return fallback;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(trimmed)) return fallback;
  return trimmed;
}

const CHECKOUT_HOST_SUFFIXES = ["dodopayments.com", "dodo.com"];

/** Validate payment checkout URLs before redirect. */
export function safeCheckoutUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (CHECKOUT_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) {
      return u.href;
    }
  } catch {
    /* invalid */
  }
  return null;
}
