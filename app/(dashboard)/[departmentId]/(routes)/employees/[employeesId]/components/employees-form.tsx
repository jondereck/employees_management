"use client";
import * as z from "zod";
import { Eligibility, Employee, EmployeeType, Gender, Image, Offices } from "@prisma/client";
import { CalendarIcon, Check, ChevronDown, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import axios from "axios";
import { useRouter, useParams } from "next/navigation";
import { AlertModal } from "@/components/modals/alert-modal";
import ImageUpload from "@/components/ui/image-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";



const formSchema = z.object({
  lastName: z.string().min(1, {
    message: "Last Name is required"
  }).transform((value) => value.toUpperCase(),),
  firstName: z.string().min(1, {
    message: "First Name is required"
  }).transform((value) => value.toUpperCase(),),
  middleName: z.string(),
  gender: z.string().min(1, {
    message: "Gender is required"
  }),
  employeeTypeId: z.string().min(1, {
    message: "Appointment  is required"
  }),
  officeId: z.string().min(1, {
    message: "Office is required"
  }),
  eligibilityId: z.string().min(1, {
    message: "Eligibility is required."
  }),

  suffix: z.string(),
  images: z.object({ url: z.string() }).array(),
  contactNumber: z.string(),
  position: z
    .string()
    .min(1, {
      message: "Position is required",
    })
    .transform((value) => {
      // Function to remove Roman numerals within parentheses, excluding at the end
      const cleanPosition = (position: string) =>
        position.replace(/\(([^)]*)\)/, (match, p1) => {
          if (p1) {
            const cleanedText = p1.replace(/\b[IVXLCDM]+\b(?![\s\S]*\b[IVXLCDM]+\b)/g, '').trim();
            return `(${cleanedText})`;
          }
          return match;
        });

      return cleanPosition(value);
    }),
  education: z.string(),
  region: z.string(),
  province: z.string(),
  city: z.string(),
  barangay: z.string(),
  houseNo: z.string(),
  street: z.string(),
  salary: z.coerce.number().min(1),
  birthday: z.date(),
  // age: z.string(),
  gsisNo: z.string(),
  pagIbigNo: z.string(),
  tinNo: z.string(),
  philHealthNo: z.string(),
  dateHired: z.date(),
  latestAppointment: z.string(),
  terminateDate: z.string(),
  isFeatured: z.boolean(),
  isArchived: z.boolean(),
  isHead: z.boolean(),
});


type EmployeesFormValues = z.infer<typeof formSchema>;

interface EmployeesFormProps {
  initialData: Employee & {
    images: Image[]
  } | null;
  offices: Offices[];
  eligibility: Eligibility[];
  employeeType: EmployeeType[];
}


export const EmployeesForm = ({
  initialData,
  offices,
  eligibility,
  employeeType,
}: EmployeesFormProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputSearchOpen, setInputSearchOpen] = useState(false);


  const [value, setValue] = useState("")



  // const fetchProvinces = async () => {
  //   try {
  //     if (selectedRegion) {
  //       const response = await axios.get(`/api/geo?action=provinces&regionId=${selectedRegion}`);
  //       setProvinces(response.data);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching provinces", error);
  //   }
  // };

  const title = initialData ? "Edit Employee" : "Create Employee";
  const description = initialData ? "Edit a Employee" : "Add new Employee";
  const toastMessage = initialData ? "Employee updated." : "Employee created.";
  const action = initialData ? "Save changes." : "Create";

  const params = useParams();
  const router = useRouter();




  const form = useForm<EmployeesFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      ...initialData,
      firstName: initialData.firstName.toUpperCase(),
      middleName: initialData.middleName.toUpperCase(),
      lastName: initialData.lastName.toUpperCase(),
      province: initialData.province.toUpperCase(),
      city: initialData.city.toUpperCase(),
      barangay: initialData.barangay.toUpperCase(),
      street: initialData.street.toUpperCase(),
      salary: parseFloat(String(initialData?.salary)),
      
    }

      : {
        lastName: '',
        firstName: '',
        middleName: '',
        suffix: '',
        images: [{ url: 'https://res.cloudinary.com/ddzjzrqrj/image/upload/v1700612053/profile-picture-vector-illustration_mxkhbc.jpg' }],
        gender: '',
        contactNumber: ' ',
        position: '',
        birthday: undefined,
        // age: '',
        gsisNo: '',
        tinNo: '',
        pagIbigNo: '',
        philHealthNo: '',
        salary: 0.00,
        dateHired: undefined,
        latestAppointment: '',
        terminateDate: '',
        isFeatured: false,
        isArchived: false,
        isHead: false,
        employeeTypeId: '',
        officeId: '',
        eligibilityId: '',
        houseNo: '',
        education: '',
        region: '',
        province: '',
        city: '',
        barangay: '',
        street: '',


      }
  });


  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);

  // Function to calculate age
  const calculateAgeFromBirthday = (birthday: Date) => {
    const today = new Date();
    const birthDate = new Date(birthday);
    const age = today.getFullYear() - birthDate.getFullYear();

    // Adjust age based on the birth month and day
    if (
      today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
    ) {
      return age;
    } else {
      return age;
    }
  };

  // Update the age whenever the birthday field changes
  useEffect(() => {
    const age = calculateAgeFromBirthday(form.getValues("birthday"));
    setCalculatedAge(age);
  }, [form.getValues("birthday")]);


  const onSubmit = async (values: EmployeesFormValues) => {
    try {
      setLoading(true);

      values.firstName = values.firstName.toUpperCase();
      values.lastName = values.lastName.toUpperCase();
      values.middleName = values.middleName.toUpperCase();
      values.province = values.province.toUpperCase();
      values.city = values.city.toUpperCase();
      values.barangay = values.barangay.toUpperCase();
      values.street = values.street.toUpperCase();
      if (initialData) {
        await axios.patch(`/api/${params.departmentId}/employees/${params.employeesId}`, values);

      } else {
        await axios.post(`/api/${params.departmentId}/employees`, values);;
      }

      router.refresh();
      router.back();


      toast({
        title: "Success!",
        description: toastMessage,
      })
    } catch (error: any) {
      if (error.response && error.response.data && error.response.data.error) {
        // Handle API error messages
        const errorMessage = error.response.data.error;
        toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: errorMessage,
        });
      } else {
        // Handle generic error
        toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: "There was a problem with your request.",
        });
      }
    } finally {
      setLoading(false);
    }
  }


  const onDelete = async () => {
    try {
      setLoading(true);

      await axios.delete(`/api/${params.departmentId}/employees/${params.employeesId}`);

      toast({
        title: "Success!",
        description: "Employee deleted."
      })

      router.refresh();
      router.push(`/${params.departmentId}/employees`)


    } catch (error) {
      toast({
        title: "Error!",
        description: "Remove all users to proceed."
      })
    } finally {
      setLoading(false);
    }
  }

  const currentYear = new Date().getFullYear();
  const fromYear = currentYear - 74;


  const genderOptions = Object.values(Gender);


  const capitalizeWordsIgnoreSpecialChars = (input: string) => {
    return input.replace(/\b\w+\b/g, (word) => {
      // Check if the word is a Roman numeral (I, II, III, IV, V, etc.)
      if (/^(?=[MDCLXVI])M{0,3}(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/.test(word.toUpperCase())) {
        return word; // Return unchanged if it's a Roman numeral
      }

      // Capitalize the word while ignoring special characters
      const wordWithoutSpecialChars = word.replace(/[^\w\s]/g, '');
      return wordWithoutSpecialChars.charAt(0).toUpperCase() +
        wordWithoutSpecialChars.slice(1).toLowerCase();
    });
  };


  function formatNumber(input: string): string {
    // Remove non-numeric characters from the input
    const numericValue = input.replace(/\D/g, '');

    // Determine the group size for formatting
    const groupSize = 3;

    // Split the numeric value into groups of three digits
    const groups = numericValue.match(new RegExp(`\\d{1,${groupSize}}`, 'g'));

    // Join the groups with a hyphen
    const formattedValue = groups ? groups.join('-') : '';

    return formattedValue;
  }

  const formatDate = (input: string) => {
    // Remove non-numeric characters
    const numericValue = input.replace(/\D/g, '');
  
    // Format the date as "mm/dd/yyyy"
    const formattedDate = numericValue
      .replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3') // Format as "mm/dd/yyyy"
      .substr(0, 10); // Limit to 10 characters (mm/dd/yyyy)
  
    return formattedDate;
  };
  


  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        loading={loading}
      />
      <div className="flex items-center justify-between">
        <Heading
          title={title}
          description={description}
        />
        {initialData && (
          <Button
            disabled={loading}
            variant="destructive"
            size="icon"
            onClick={() => setOpen(true)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div >
      <Separator />
      <Form {...form} >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 w-full">
          <h1 className="font-sans text-4xl font-bold">Profile</h1>
          <FormField
            control={form.control}
            name="images"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ImageUpload
                    value={field.value.map((image => image.url))}
                    disabled={loading}
                    onChange={(url) => field.onChange([...field.value, { url }])}
                    onRemove={(url) => field.onChange([...field.value.filter((current) => current.url !== url)])}
                  />
                </FormControl>
                <FormDescription>
                  Upload picture of an employee
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="sm:grid sm:grid-1 md:grid-2 grid-cols-3 gap-8">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="First Name"
                      {...field}
                      onChange={(e) => {
                        // Convert the input value to uppercase
                        const uppercaseValue = e.target.value.toUpperCase();
                        // Set the field value to the uppercase value
                        field.onChange(uppercaseValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Ex: Jon
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Last Name"
                      {...field}
                      onChange={(e) => {
                        // Convert the input value to uppercase
                        const uppercaseValue = e.target.value.toUpperCase();
                        // Set the field value to the uppercase value
                        field.onChange(uppercaseValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Ex: Nifas
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="middleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Middle Name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Middle Name"
                      {...field}
                      onChange={(e) => {
                        // Convert the input value to uppercase
                        const uppercaseValue = e.target.value.toUpperCase();
                        // Set the field value to the uppercase value
                        field.onChange(uppercaseValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Ex: De Guzman
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="suffix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Suffix </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Suffix"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Ex: Jr.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Position </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Position"
                      {...field}
                      onChange={(e) => {
                        // Convert the input value to uppercase for every word
                        const capitalizedValue = capitalizeWordsIgnoreSpecialChars(
                          e.target.value
                        );

                        // Set the field value to the capitalized value
                        field.onChange(capitalizedValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Ex: Administrative Officer III
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Number </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Contact Number"
                      {...field}
                      onChange={(e) => {
                        // Remove the "+63" prefix and any non-numeric characters
                        const formattedValue = e.target.value.replace(/^(\+63|63|0)/, '').replace(/\D/g, ''); // Remove non-numeric characters
                        field.onChange(formattedValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>

                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="birthday"
              render={({ field }) => (
                <FormItem className="flex flex-col mt-2">
                  <FormLabel>Date of birth</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"} w-auto justify-start text-left font-normal
                        className={cn("w-auto  justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className=" w-auto p-0">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown-buttons"
                        selected={field.value}
                        onSelect={field.onChange}
                        fromYear={fromYear}
                        toYear={currentYear}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Your date of birth is used to calculate your age.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* <FormField
        control={form.control}
        name="age"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Age</FormLabel>
            <FormControl>
              <Input
                disabled={loading}
            
                {...field}
              />
            </FormControl>
          </FormItem>
        )}
      /> */}
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender </FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          defaultValue={field.value}
                          placeholder="Select gender "
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {genderOptions.map((item) => (
                        <SelectItem
                          key={item}
                          value={item}
                        >
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="education"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Education</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Education"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Ex: Bachelor of Information Technology
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />


          </div>
          <Separator />
          <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
            {/* <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Ilocos"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This Information is private
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            /> */}
            <FormField
              control={form.control}
              name="province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Province</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Pangasinan"
                      {...field}
                      onChange={(e) => {
                        // Convert the input value to uppercase
                        const uppercaseValue = e.target.value.toUpperCase();
                        // Set the field value to the uppercase value
                        field.onChange(uppercaseValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City/Municipal</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Lingayen"
                      {...field}
                      onChange={(e) => {
                        // Convert the input value to uppercase
                        const uppercaseValue = e.target.value.toUpperCase();
                        // Set the field value to the uppercase value
                        field.onChange(uppercaseValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="barangay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Barangay</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Wawa"
                      {...field}
                      onChange={(e) => {
                        // Convert the input value to uppercase
                        const uppercaseValue = e.target.value.toUpperCase();
                        // Set the field value to the uppercase value
                        field.onChange(uppercaseValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />


            <FormField
              control={form.control}
              name="houseNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit/Number</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Home Number"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    This is optional
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Mendoza Street"
                      {...field}
                      onChange={(e) => {
                        // Convert the input value to uppercase
                        const uppercaseValue = e.target.value.toUpperCase();
                        // Set the field value to the uppercase value
                        field.onChange(uppercaseValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    This is optional
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />


          </div>

          <Separator />

          <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
            <FormField
              control={form.control}
              name="salary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Salary </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Salary"
                      {...field}
                      onChange={(e) => {
                        // Get the input value and remove commas and periods
                        const inputValue = e.target.value.replace(/[,\.]/g, '');

                        // Update the field value with the modified input
                        field.onChange(inputValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value && `₱ ${Number(field.value).toLocaleString()}`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* <FormField
              control={form.control}
              name="officeId"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-col gap-4">
                    <FormLabel>Office </FormLabel>
                  <Popover open={inputSearchOpen} onOpenChange={setInputSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={inputSearchOpen}
                        className="w-auto justify-between"
                      >
                        {field.value ? offices.find((office) => office.name === field.value)?.id : "Select Office..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
             
                    <PopoverContent className="w-auto p-0">
                      <Command>
                        <CommandInput placeholder="Search office..." />
                        <CommandEmpty>No office found.</CommandEmpty>
                        <CommandGroup className="max-h-48 overflow-y-auto">
                        {offices.map((office) => (
                  <CommandItem
                    key={office.id}
                       value={office.id}        
                    onSelect={(currentValue) => {
                      field.onChange(currentValue === field.value ? "" : currentValue);
                      setOpen(false);
                    }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  field.value === office.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {office.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  </div>
                  
                  <FormMessage />
                </FormItem>
              )}
            /> */}

            <FormField
              control={form.control}
              name="officeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Office </FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          defaultValue={field.value}
                          placeholder="Select Office "
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent style={{ maxHeight: '200px', overflowY: 'auto' }} >
                      {offices
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                    </SelectContent>

                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="employeeTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Appointment </FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          defaultValue={field.value}
                          placeholder="Select Appointment "
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employeeType.map((item) => (
                        <SelectItem
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>

                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eligibilityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Eligibility </FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          defaultValue={field.value}
                          placeholder="Select Eligibility "
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {eligibility.map((item) => (
                        <SelectItem
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>

                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Separator />
          <div className="grid lg:grid-cols-2 grid-cols-1 gap-8">
            <FormField
              control={form.control}
              name="gsisNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GSIS Number</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Ex: 000-000-0000"
                      {...field}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        const formattedValue = formatNumber(inputValue);
                        field.onChange(formattedValue);
                      }}
                    />

                  </FormControl>
                  <FormDescription>

                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tinNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TIN Number</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="TIN Number"
                      {...field}
                      {...field}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        const formattedValue = formatNumber(inputValue);
                        field.onChange(formattedValue);
                      }}

                    />

                  </FormControl>
                  <FormDescription>

                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="philHealthNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Philhealth Number</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Philhealth Number"
                      {...field}
                      {...field}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        const formattedValue = formatNumber(inputValue);
                        field.onChange(formattedValue);
                      }}
                    />

                  </FormControl>
                  <FormDescription>

                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pagIbigNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pagibig Number</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Pagibig Number"
                      {...field}
                      {...field}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        const formattedValue = formatNumber(inputValue);
                        field.onChange(formattedValue);
                      }}
                    />

                  </FormControl>
                  <FormDescription>

                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateHired"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date hired</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn("w-auto  justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className=" w-auto p-0">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown-buttons"
                        selected={field.value}
                        onSelect={field.onChange}
                        fromYear={fromYear}
                        toYear={currentYear}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Date hired is used to calculate years of service.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="latestAppointment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latest Appointment </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="mm/dd/yyyy"
                      {...field}
                      onChange={(e) => {
                        const formattedValue = formatDate(e.target.value);
                        field.onChange(formattedValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    This field is optional for employee with the most recent appointment.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}

            />
            <FormField
              control={form.control}
              name="terminateDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Termination Date </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="mm/dd/yyyy"
                      {...field}
                      onChange={(e) => {
                        const formattedValue = formatDate(e.target.value);
                        field.onChange(formattedValue);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                  This field is optional for employee is terminated/retired.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid lg:grid-cols-2  grid-cols-1 gap-8  space-y-0 ">
            <FormField
              control={form.control}
              name='isHead'
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      //@ts-ignore
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Is this employee in Executive Level Position?</FormLabel>
                    <FormDescription>
                      Marking this option will ensure that this employee always appears at the top.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='isFeatured'
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      //@ts-ignore
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Is featured employee?</FormLabel>
                    <FormDescription>
                      This employee will apear on home page
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='isArchived'
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      //@ts-ignore
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Archived employee?</FormLabel>
                    <FormDescription>
                      This employee will not appear anywhere
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>
          <Separator />
          <Button disabled={loading} className="ml-auto" type="submit">
            {action}
          </Button>
        </form>
      </Form>

    </>
  );
}

