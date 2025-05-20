export function saveCopyOptionsToLocalStorage(fields: string[], format: string) {
  try {
    localStorage.setItem(
      "copyOptions",
      JSON.stringify({ fields, format })
    );
  } catch (err) {
    console.error("Failed to save copy options:", err);
  }
}
