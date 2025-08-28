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
