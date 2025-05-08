import { FC, useState, useEffect } from "react";

// Add a delay function for debouncing
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface SearchFilterProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

const SearchFilter: FC<SearchFilterProps> = ({ searchTerm, setSearchTerm }) => {
  // Use debounced value to prevent multiple re-renders while typing
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    setSearchTerm(debouncedSearchTerm);
  }, [debouncedSearchTerm, setSearchTerm]); 

  return (
    <div className="py-4">
      <input
        type="text"
        className="border px-4 py-2 rounded-md w-3/4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
        placeholder="Search employees by first name, last name,contact number "
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label="Search employees by first name, last name,contact number, nickname, position, barangay, or etc. "
      />
    </div>
  );
};

export default SearchFilter;
