import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const formatter = new Intl.NumberFormat("en-US", {
  style:'currency',
  currency: 'PHP',
});

export const  formatTinNumber = (tin: string) =>  {
  // Assuming tin is a string like "410461301"
  if (tin && tin.length === 9) {
    return `${tin.slice(0, 3)}-${tin.slice(3, 6)}-${tin.slice(6, 9)}`;
  } else {
    // Handle invalid or unexpected TIN number format
    return tin;
  }
}