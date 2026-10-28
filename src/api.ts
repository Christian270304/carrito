export async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "X-Requested-With": "en-casa", ...options.headers },
    credentials: "same-origin",
  });
  if (response.status === 401 && !path.endsWith("/login"))
    window.dispatchEvent(new Event("session-expired"));
  return response;
}
