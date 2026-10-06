const ACCESS_COOKIE = "Outseta.nocode.accessToken";
const SHARED_COOKIE_DOMAIN = ".foundationmacro.com";

function isFoundationHost(hostname: string) {
  return hostname === "foundationmacro.com" || hostname.endsWith(SHARED_COOKIE_DOMAIN);
}

/** Expire the parent-domain cookie so marketing site and Terminus stay in sync. */
export function clearSharedOutsetaCookie() {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (!isFoundationHost(window.location.hostname)) return;
  document.cookie = `${ACCESS_COOKIE}=; Path=/; Domain=${SHARED_COOKIE_DOMAIN}; Max-Age=0; Secure; SameSite=Lax`;
}

export async function signOutOfOutseta(logout: () => unknown) {
  try {
    await Promise.resolve(logout());
  } finally {
    clearSharedOutsetaCookie();
  }
}
