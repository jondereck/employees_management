export const COLUMN_GROUPS = [
  {
    key: "personal",
    title: "Personal Details",
    items: [
      "lastName",
      "firstName",
      "middleName",
      "suffix",
      "nickname",
      "gender",
      "birthday",
    ],
  },
  {
    key: "job",
    title: "Job Details",
    items: [
      "position",
      "employeeTypeId",
      "salaryGrade",
      "salaryStep",
      "dateHired",
      "latestAppointment",
      "isHead",
      "isAwardee",
      "office",
    ],
  },
  {
    key: "address",
    title: "Address",
    items: [
      "houseNo",
      "street",
      "barangay",
      "city",
      "province",
      "region",
    ],
  },
  {
    key: "govIds",
    title: "Government IDs",
    items: ["gsisNo", "tinNo", "philHealthNo", "pagIbigNo"],
  },
] as const;

export type ColumnGroupKey = typeof COLUMN_GROUPS[number]["key"];
