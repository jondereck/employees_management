// lib/http.ts
export async function jsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  if (!text) return null;
  try { return JSON.parse(text) as T; } 
  catch { throw new Error(`Invalid JSON: ${text.slice(0, 300)}`); }
}
