import { Row, Column, SortDirection } from "@tanstack/react-table";

// Define the type of your row data
interface Employee {
  [key: string]: any; // Adjust this as needed based on your data structure
}

export const dateSort = <TData extends Employee>(
  rowA: Row<TData>,
  rowB: Row<TData>,
  columnId: string,
  direction: SortDirection
): number => {
  const dateA = new Date(rowA.original[columnId]);
  const dateB = new Date(rowB.original[columnId]);

  if (direction === 'asc') {
    return dateA.getTime() - dateB.getTime();
  } else {
    return dateB.getTime() - dateA.getTime();
  }
};
