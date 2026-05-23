/** Allow only http(s) links in user- or AI-sourced hrefs. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol === "https:" || u.protocol === "http:") return u.href;
  } catch {
    /* invalid URL */
  }
  return null;
}
