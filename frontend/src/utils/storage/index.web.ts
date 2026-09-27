// Web implementation uses localStorage.
export async function getItem(key: string): Promise<string | null> {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key);
}
