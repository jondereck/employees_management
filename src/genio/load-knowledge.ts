  import fs from "fs";
  import XLSX from "xlsx";
  import path from "path";



  export function loadEmployeesFromExcel() {
    const filePath = path.join(
      process.cwd(),
      "src",
      "genio",
      "knowledge",
      "employees.xlsx"
    );

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    return XLSX.utils.sheet_to_json(sheet);
  }



  export function chunkText(text: string, size = 400) {
    const lines = text.split("\n").filter(Boolean);
    const chunks: string[] = [];

    let buffer = "";

    for (const line of lines) {
      if ((buffer + line).length > size) {
        chunks.push(buffer);
        buffer = line;
      } else {
        buffer += "\n" + line;
      }
    }

    if (buffer) chunks.push(buffer);

    return chunks;
  }


  export function retrieveRelevantKnowledge(
    chunks: string[],
    question: string,
    limit = 3
  ) {
    const keywords = question.toLowerCase().split(" ");

    return chunks
      .map((chunk) => {
        const score = keywords.filter((k) =>
          chunk.toLowerCase().includes(k)
        ).length;

        return { chunk, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((c) => c.chunk);
  }


  // src/genio/build-knowledge.ts

  export function buildEmployeeKnowledgeText(rows: any[]) {
    return rows
      .map((e) => {
        const first = e["First Name"]?.trim() ?? "";
        const middle = e["M.I."]?.trim() ?? "";
        const last = e["Last Name"]?.trim() ?? "";
        const suffix = e["Suffix"]?.trim() ?? "";

        const fullName = [first, middle, last, suffix]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .toUpperCase();

        // 🔑 NEW FIELDS
        const birthday = e["Birthday"]
          ? new Date(e["Birthday"]).toDateString()
          : "Not specified";

        const dateHired = e["Date Hired"]
          ? new Date(e["Date Hired"]).toDateString()
          : "Not specified";

          const gender = e["Gender"] ?? "Not specified";

        return `
  EMPLOYEE:
  Name: ${fullName}
  Gender: ${gender}
  Position: ${e["Position"] ?? "Not specified"}
  Office: ${e["Office"] ?? "Not specified"}
  Birthday: ${birthday}
  Date Hired: ${dateHired}
  Barangay: ${e["Barangay"] ?? "Not specified"}
  City: ${e["City"] ?? "Not specified"}
  `;
      })
      .join("\n---\n");
  }