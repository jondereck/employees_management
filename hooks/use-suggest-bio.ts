import { useCallback, useState } from "react";

export function useSuggestBio(departmentId?: string) {
  const [loading, setLoading] = useState(false);

  const suggestForOffice = useCallback(async (officeId?: string) => {
    if (!departmentId || !officeId) return { bio: "", error: "Missing ids" };
    setLoading(true);
    try {
      const res = await fetch(
        `/api/${departmentId}/offices/${officeId}/suggest-bio`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const text = await res.text();
        return { bio: "", error: text || "Failed to suggest" };
      }
      const data = await res.json(); // { suggestion: "854003", ... }
      return { bio: String(data.suggestion || ""), error: "" };
    } catch (e: any) {
      return { bio: "", error: e?.message ?? "Network error" };
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  return { loading, suggestForOffice };
}
