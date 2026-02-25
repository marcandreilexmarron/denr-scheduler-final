export function saveToken(t: string) {
  localStorage.setItem("token", t);
  window.dispatchEvent(new Event("auth:changed"));
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function clearToken() {
  localStorage.removeItem("token");
  window.dispatchEvent(new Event("auth:changed"));
}

export function getUserFromToken(): { sub: string; role: string; officeName?: string; service?: string } | null {
  const t = getToken();
  if (!t) return null;
  try {
    const payload = JSON.parse(atob(t.split(".")[1]));
    return payload;
  } catch {
    return null;
  }
}

export function onAuthChange(cb: () => void) {
  function handler() {
    cb();
  }
  window.addEventListener("auth:changed", handler);
  return () => window.removeEventListener("auth:changed", handler);
}
