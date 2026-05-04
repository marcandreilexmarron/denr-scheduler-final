export function saveToken(t: string) {
  try {
    sessionStorage.setItem("token", t);
  } catch {}
  try {
    localStorage.removeItem("token");
  } catch {}
  window.dispatchEvent(new Event("auth:changed"));
}

export function getToken(): string | null {
  try {
    const v = sessionStorage.getItem("token");
    if (v) return v;
  } catch {}
  try {
    const legacy = localStorage.getItem("token");
    if (legacy) {
      try {
        sessionStorage.setItem("token", legacy);
      } catch {}
      try {
        localStorage.removeItem("token");
      } catch {}
      return legacy;
    }
  } catch {}
  return null;
}

export function clearToken() {
  try {
    sessionStorage.removeItem("token");
  } catch {}
  try {
    localStorage.removeItem("token");
  } catch {}
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
