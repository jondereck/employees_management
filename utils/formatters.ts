  export const applyFormat = (text: string, format: "uppercase" | "lowercase" | "capitalize") => {
  switch (format) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    default:
      return text;
  }
};


/**
 * Returns Full Name with Middle Initial (e.g., JOHN "JAY" D. DOE SR.)
 */
export const buildNameWithInitial = (data: any) => {
  const firstName = data.firstName?.trim().toUpperCase() || "";
  const lastName = data.lastName?.trim().toUpperCase() || "";
  
  // Convert Middle Name to Initial (e.g., "Delacruz" -> "D.")
  const middleInitial = data.middleName?.trim() 
    ? `${data.middleName.trim().charAt(0).toUpperCase()}.`
    : "";

  const prefix = data.prefix?.trim() || "";
  const suffix = data.suffix?.trim().toUpperCase() || "";

  // Filter out empty parts and join with single spaces
  return [prefix, firstName, middleInitial, lastName, suffix]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

export const buildFullName = (data: any) => {
  const middle = data.middleName?.length === 1 
    ? `${data.middleName.toUpperCase()}.`
    : data.middleName?.toUpperCase() || "";

  return `${data.prefix || ""} ${data.firstName.toUpperCase()} ${
    data.nickname ? `"${data.nickname}"` : ""
  } ${middle} ${data.lastName.toUpperCase()} ${data.suffix?.toUpperCase() || ""}`.trim();
};

export const buildCopyFullName = (data: any) => {
  return `${data.firstName.toUpperCase()}${
    data.middleName ? " " + data.middleName[0].toUpperCase() + "." : ""
  } ${data.lastName.toUpperCase()} ${data.suffix?.toUpperCase() || ""}`.trim();
};
