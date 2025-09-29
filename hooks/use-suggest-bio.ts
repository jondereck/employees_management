import { useCallback, useState } from "react";

export type BioSuggestion = {
  indexCode: string;  // e.g. "2050000" or "RHU"
  candidate: string;  // e.g. "2050001" or "RHU"
};

type SuggestResponse =
  | { suggestions: BioSuggestion[] }                 // new shape
  | { suggestion?: string; suggestions?: undefined } // legacy shape

export function useSuggestBio(departmentId?: string) {
  const [loading, setLoading] = useState(false);

  const suggestForOffice = useCallback(async (officeId?: string) => {
    if (!departmentId || !officeId) {
      return { suggestions: [] as BioSuggestion[], error: "Missing ids" };
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/${departmentId}/offices/${officeId}/suggest-bio`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const text = await res.text();
        return { suggestions: [] as BioSuggestion[], error: text || "Failed to suggest" };
      }

      const data: SuggestResponse = await res.json();

      // Back-compat: if server returns single { suggestion: "..." }
      if ("suggestion" in data && data.suggestion) {
        return {
          suggestions: [{ indexCode: "", candidate: String(data.suggestion) }],
          error: "",
        };
      }

      // Normal: array of { indexCode, candidate }
      const suggestions = Array.isArray((data as any).suggestions)
        ? (data as any).suggestions
            .filter((s: any) => s && typeof s.candidate === "string")
            .map((s: any) => ({
              indexCode: String(s.indexCode ?? ""),
              candidate: String(s.candidate),
            }))
        : [];

      return { suggestions, error: "" };
    } catch (e: any) {
      return { suggestions: [] as BioSuggestion[], error: e?.message ?? "Network error" };
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  return { loading, suggestForOffice };
}
