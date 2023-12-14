"use client";
import Select from 'react-select';
import useAddresses from "@/hooks/use-address";

export type AddressSelectValue = {
  value: string,
  barangay: string,
  municipality: string,
  province: string,
  region: string,
}

interface AddressSelectValueProps {
  value?: AddressSelectValue;
  onChange: (value: AddressSelectValue) => void;
}

const AddressSelect = ({
  value,
  onChange
}: AddressSelectValueProps) => {
  const { getAll } = useAddresses();
  
  return (
    <div>
    <Select
     placeholder="Anywhere"
     isClearable
     options={getAll().barangays}
     value={value ? { value: value, label: value } : null} // Convert string to AddressSelectValue
     onChange={(selectedValue) => onChange(selectedValue?.value || '')} // Extract the value property
      formatOptionLabel={(option: any) => (
        <div className="
        flex flex-row items-center gap-3">

          <div>
            {option.label},
            <span className="text-neutral-500 ml-1">
              {option.province}
            </span>
          </div>
        </div>
      )}
      classNames={{
        control: () => 'p-3 border-2',
        input: () => 'text-lg',
        option: () => 'text-lg'
      }}
      theme={(theme) => ({
        ...theme,
        borderRadius: 6,
        colors: {
          ...theme.colors,
          primary: 'black',
          primary25: '#ffe4e6'
        }
      })}
    />
  </div>
  
    );
}

export default AddressSelect;