"use client";
import * as z from "zod";
import { mutate as globalMutate } from "swr";
import { Eligibility, Employee, EmployeeType, Gender, Image, Offices } from "@prisma/client";
import { CalendarIcon, Check, ChevronDown, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useState } from "react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast, Toaster } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
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
import eachDayOfInterval from "date-fns/eachDayOfInterval/index";
import { capitalizeWordsIgnoreSpecialChars, formatToProperCase, formatToUpperCase } from "@/utils/utils";
import { AutoFillField } from "../../components/autofill";
import { SalaryInput } from "../../components/salary-input";
import { StepIndicator } from "../../components/step-indicator";
import { employeesKey, useEmployee } from "@/hooks/use-employees";



const formSchema = z.object({
  step: z.number().optional(),
  prefix: z.string(),
  employeeNo: z.string(),
  lastName: z.string().min(1, {
    message: "Last Name is required"
  }),

  firstName: z.string().min(1, {
    message: "First Name is required"
  }),
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
    }),
  education: z.string(),
  region: z.string(),
  province: z.string(),
  city: z.string(),
  barangay: z.string(),
  houseNo: z.string(),
  street: z.string(),
  salaryGrade: z.union([z.string(), z.number()])
    .transform((v) => String(v)) // always string for Prisma
    .refine((v) => /^\d+$/.test(v), "Salary Grade must be numeric"),
  salary: z.number().min(0),
  birthday: z.date().optional(),
  // age: z.string(),
  gsisNo: z.string(),
  pagIbigNo: z.string(),
  tinNo: z.string(),
  philHealthNo: z.string(),
  dateHired: z.union([z.date(), z.string()]).optional(),
  latestAppointment: z.union([z.date(), z.string()]).optional(),
  terminateDate: z.string(),
  isFeatured: z.boolean(),
  isArchived: z.boolean(),
  isHead: z.boolean(),
  memberPolicyNo: z.string(),
  age: z.string(),
  nickname: z.string(),
  emergencyContactName: z.string(),
  emergencyContactNumber: z.string(),
  employeeLink: z.string(),
});

type EmployeesFormValues = z.infer<typeof formSchema>;
const upper = (s?: string | null) => (s ?? "").toUpperCase();
const EMPTY_DEFAULTS: EmployeesFormValues = {
  step: undefined,
  prefix: "",
  employeeNo: "",
  lastName: "",
  firstName: "",
  middleName: "",
  gender: "",
  employeeTypeId: "",
  officeId: "",
  eligibilityId: "",
  suffix: "",
  images: [{ url: "https://res.cloudinary.com/ddzjzrqrj/image/upload/v1700612053/profile-picture-vector-illustration_mxkhbc.jpg" }],
  contactNumber: "",
  position: "",
  education: "",
  region: "",
  province: "",
  city: "",
  barangay: "",
  houseNo: "",
  street: "",
  salaryGrade: "0",
  salary: 0,
  birthday: undefined,
  gsisNo: "",
  pagIbigNo: "",
  tinNo: "",
  philHealthNo: "",
  dateHired: undefined,
  latestAppointment: undefined,
  terminateDate: "",
  isFeatured: false,
  isArchived: false,
  isHead: false,
  memberPolicyNo: "",
  age: "",
  nickname: "",
  emergencyContactName: "",
  emergencyContactNumber: "",
  employeeLink: "",
};

function mapToDefaults(src: any): EmployeesFormValues {
  if (!src) return EMPTY_DEFAULTS;
  return {
    ...EMPTY_DEFAULTS,
    // IDs
    employeeTypeId: src.employeeTypeId ?? "",
    officeId: src.officeId ?? "",
    eligibilityId: src.eligibilityId ?? "",
    // Names (UPPERCASE safely)
    firstName: upper(src.firstName),
    middleName: upper(src.middleName),
    lastName: upper(src.lastName),
    prefix: src.prefix ?? "",
    suffix: src.suffix ?? "",
    // Address (UPPERCASE safely)
    region: upper(src.region),
    province: upper(src.province),
    city: upper(src.city),
    barangay: upper(src.barangay),
    street: upper(src.street),
    houseNo: src.houseNo ?? "",
    // Others
    employeeNo: src.employeeNo ?? "",
    gender: src.gender ?? "",
    contactNumber: src.contactNumber ?? "",
    position: src.position ?? "",
    education: src.education ?? "",
    salary: Number(src.salary ?? 0),
    salaryGrade: String(src.salaryGrade ?? "1"),
    birthday: src.birthday ? new Date(src.birthday) : undefined,
    dateHired: src.dateHired ? new Date(src.dateHired) : undefined,
    latestAppointment: src.latestAppointment ? new Date(src.latestAppointment) : undefined,
    terminateDate: src.terminateDate ?? "",
    isFeatured: !!src.isFeatured,
    isArchived: !!src.isArchived,
    isHead: !!src.isHead,
    memberPolicyNo: src.memberPolicyNo ?? "",
    age: src.age?.toString?.() ?? "",
    nickname: src.nickname ?? "",
    emergencyContactName: src.emergencyContactName ?? "",
    emergencyContactNumber: src.emergencyContactNumber ?? "",
    employeeLink: src.employeeLink ?? "",
    images: Array.isArray(src.images) && src.images.length > 0 ? src.images.map((i: any) => ({ url: i.url })) : EMPTY_DEFAULTS.images,
  };
}


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
  const action = initialData ? "Save changes" : "Create";


  const router = useRouter();




  const form = useForm<EmployeesFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData 
      ? {
        ...initialData,
        firstName: initialData.firstName.toUpperCase(),
        middleName: initialData.middleName.toUpperCase(),
        lastName: initialData.lastName.toUpperCase(),
        province: initialData.province.toUpperCase(),
        city: initialData.city.toUpperCase(),
        barangay: initialData.barangay.toUpperCase(),
        street: initialData.street.toUpperCase(),

        salary: Number(initialData.salary ?? 0),
        salaryGrade: String(initialData.salaryGrade ?? "1"), // ✅ cast to string

        dateHired: initialData.dateHired ? new Date(initialData.dateHired) : undefined,
        latestAppointment: initialData.latestAppointment ? new Date(initialData.latestAppointment) : undefined,
      }
      : {
        prefix: '',
        employeeNo: '',
        lastName: '',
        firstName: '',
        middleName: '',
        suffix: '',
        images: [
          {
            url: 'https://res.cloudinary.com/ddzjzrqrj/image/upload/v1700612053/profile-picture-vector-illustration_mxkhbc.jpg',
          },
        ],
        gender: '',
        contactNumber: '',
        position: '',
        birthday: undefined,
        age: '',
        gsisNo: '',
        tinNo: '',
        pagIbigNo: '',
        philHealthNo: '',
        salary: 0,
        salaryGrade: "0", // ✅ make it string here too
        dateHired: undefined,
        latestAppointment: undefined,
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
        memberPolicyNo: '',
        nickname: '',
        emergencyContactName: '',
        emergencyContactNumber: '',
        employeeLink: '',
      },
  });


  const [calculatedAge, setCalculatedAge] = useState(0);

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


  const params = useParams() as { departmentId: string; employeesId?: string };
  const key = employeesKey(params.departmentId);

   const { departmentId, employeesId } = useParams() as {
    departmentId: string;
    employeesId?: string;
  };

  

    const { data: employee } = useEmployee(departmentId, employeesId);
  const initialDefaults = useMemo(
    () => (employee ? mapToDefaults(employee) : initialData ? mapToDefaults(initialData) : EMPTY_DEFAULTS),
    // only compute from SSR (initialData); SWR reset will run in useEffect below
    [initialData, employee] // safe; recomputes when SWR arrives
  );

  useEffect(() => {
    if (employee) {
      form.reset(mapToDefaults(employee));
    } else if (initialData) {
      form.reset(mapToDefaults(initialData));
    } else {
      form.reset(EMPTY_DEFAULTS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, initialData]);




  const onSubmit = async (values: EmployeesFormValues) => {

     setLoading(true);
    try {
      const toastId = toast.loading("Processing...", { description: "Please wait while we save your data." });

      const payload = {
        ...values,
        salaryGrade: String(values.salaryGrade ?? ""),
        salary: Number(values.salary ?? 0),
      };

      // Call the API
      const res = initialData
        ? await axios.patch(`/api/${params.departmentId}/employees/${params.employeesId}`, payload)
        : await axios.post(`/api/${params.departmentId}/employees`, payload);

      const saved = res.data; // <-- return full employee from API

      // ✅ Optimistic update SWR cache (no page refresh)
      await globalMutate(
        key,
        (curr: any[] | undefined) => {
          const list = curr ?? [];
          if (initialData) {
            // replace edited row
            return list.map((e) => (e.id === saved.id ? { ...e, ...saved } : e));
          } else {
            // prepend new row
            return [saved, ...list];
          }
        },
        false // don't revalidate yet; instant UI update
      );

      // 🔄 Then revalidate to ensure perfect server state
      globalMutate(key);
      router.back();
      toast.success("Success!", { id: toastId, description: initialData ? "Employee updated." : "Employee created." });
    } catch (error: any) {
      toast.error("Uh oh! Something went wrong.", {
        description: error?.response?.data?.error ?? "There was a problem with your request.",
      });
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setLoading(true);

      await axios.delete(`/api/${params.departmentId}/employees/${params.employeesId}`);

      toast.success("Success!", {
        description: "Employee deleted.",
      });

      router.refresh();
      router.push(`/${params.departmentId}/employees`)


    } catch (error) {

      toast.success("Error!", {
        description: "Remove all users to proceed.",
      });

    } finally {
      setLoading(false);
    }
  }

  const currentYear = new Date().getFullYear();
  const fromYear = currentYear - 74;


  const genderOptions = Object.values(Gender);





  function formatNumber(input: string): string {
    const numericValue = input.replace(/\D/g, '');
    const groupSize = 3;
    const groups = numericValue.match(new RegExp(`\\d{1,${groupSize}}`, 'g'));
    return groups ? groups.join('-') : '';
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

          <div className="sm:grid sm:grid-1 md:grid-2 grid-cols-4 gap-8">
            <FormField
              control={form.control}
              name="employeeNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee No.</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Employee No."
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
                    Ex: T-3
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prefix</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Prefix"
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
                    Ex: Hon., Engr., Dr., etc.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nickname</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Nickname"
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
                    Ex: JD
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                        const uppercaseValue = formatToUpperCase(e.target.value);
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
                        const uppercaseValue = formatToUpperCase(e.target.value);
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
                        const uppercaseValue = formatToUpperCase(e.target.value);
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
                      onChange={(e) => {
                        const uppercaseValue = formatToUpperCase(e.target.value);
                        field.onChange(uppercaseValue);
                      }}
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
                <AutoFillField
                  label="Position"
                  field={field}
                  endpoint="/api/autofill/positions"
                  placeholder="Search or enter Position..."
                />
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
                        const inputValue = e.target.value;
                        if (inputValue.length <= 11) {
                          const formattedValue = inputValue.replace(/^(\+63|63|)/, '').replace(/\D/g, ''); // Remove non-numeric characters
                          field.onChange(formattedValue);
                        }
                      }
                      }
                    // Remove the "+63" prefix and any non-numeric characters

                    />
                  </FormControl>
                  <FormDescription>
                    {field.value && field.value.length != 11 && <span className="text-red-600">Please check the contact number</span>}
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
                  <FormLabel>Age </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Age"
                       
       
                      {...field}
                   
                    />
                  </FormControl>
                  <FormDescription>

                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            /> */}

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
            />  <FormField
              control={form.control}
              name="education"
              render={({ field }) => (
                <AutoFillField
                  label="Education"
                  field={field}
                  endpoint="/api/autofill/educations"
                  placeholder="Search or enter Position..."
                />
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
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Emergency Contact Name"
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
                    Contact when emergecy
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emergencyContactNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact Number </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Emergency Contact Number"
                      {...field}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue.length <= 11) {
                          const formattedValue = inputValue.replace(/^(\+63|63|)/, '').replace(/\D/g, ''); // Remove non-numeric characters
                          field.onChange(formattedValue);
                        }
                      }
                      }
                    // Remove the "+63" prefix and any non-numeric characters

                    />
                  </FormControl>
                  <FormDescription>
                    {field.value && field.value.length != 11 && <span className="text-red-600">Please check the contact number</span>}
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
                <AutoFillField
                  label="Street"
                  field={field}
                  endpoint="/api/autofill/streets"
                  placeholder="Search or enter Street..."
                  uppercase={true}
                />
              )}
            />

            <FormField
              control={form.control}
              name="barangay"
              render={({ field }) => (
                <AutoFillField
                  label="Barangay"
                  field={field}
                  endpoint="/api/autofill/barangays"
                  placeholder="Search or enter Barangay..."
                  uppercase={true}
                />
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <AutoFillField
                  label="City"
                  field={field}
                  endpoint="/api/autofill/cities"
                  placeholder="Search or enter City..."
                />
              )}
            />

            <FormField
              control={form.control}
              name="province"
              render={({ field }) => (
                <AutoFillField
                  label="Province"
                  field={field}
                  endpoint="/api/autofill/provinces"
                  placeholder="Search or enter Province..."
                />
              )}
            />
          </div>

          <Separator />
          <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
            <SalaryInput form={form} loading={loading} maxStep={8} />
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
                  <div className="flex overflow-auto">
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
                  </div>
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
                        variant="outline"
                        className={cn(
                          "w-auto justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown-buttons"
                        selected={field.value ? new Date(field.value) : undefined}
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
                      placeholder="000-000-000-0"
                      {...field}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue.length <= 12) {
                          // If the input length is 10 or less, update the field value
                          const formattedValue = formatNumber(inputValue);
                          field.onChange(formattedValue);
                        }
                        // If input length exceeds 10 characters, do not update the field value
                      }}
                    />

                  </FormControl>
                  <FormDescription>
                    {field.value && field.value.length !== 13 && <span className="text-red-600">GSIS number must be 10 characters long.</span>}
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
                      placeholder="000-000-000"
                      {...field}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue.length <= 11) {
                          const formattedValue = formatNumber(inputValue);
                          field.onChange(formattedValue);
                        }
                      }}

                    />

                  </FormControl>
                  <FormDescription>
                    {field.value && field.value.length !== 11 && <span className="text-red-600">TIN number must be 9 characters long.</span>}
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
                      placeholder="000-000-000-000"
                      {...field}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue.length <= 15) {
                          const formattedValue = formatNumber(inputValue);
                          field.onChange(formattedValue);
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value && field.value.length !== 15 && <span className="text-red-600">TIN number must be 12 characters long.</span>}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="memberPolicyNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Member Policy Number</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Member Policy Number"
                      {...field}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue.length <= 13) {
                          field.onChange(inputValue);
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value && field.value.length !== 13 && <span className="text-red-600">Member Policy number must be 13 characters long.</span>}
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
                      placeholder="000-000-000-000"
                      {...field}
                      {...field}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue.length <= 15) {
                          const formattedValue = formatNumber(inputValue);
                          field.onChange(formattedValue);
                        }
                      }}
                    />

                  </FormControl>
                  <FormDescription>
                    {field.value && field.value.length !== 15 && <span className="text-red-600">Pagibig Policy number must be 12 characters long.</span>}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="latestAppointment"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Latest Appointment</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-auto justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown-buttons"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => field.onChange(date?.toISOString() ?? undefined)}
                        fromYear={fromYear}
                        toYear={currentYear}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    This field is optional for employees with the most recent appointment.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />


            <FormField
              control={form.control}
              name="employeeLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee&rsquo;s File</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="https:// "
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Please provide the URL link to the employee&rsquo;s file. Ensure it is accessible and correctly formatted (if applicable).
                  </FormDescription>
                  <FormMessage>
                    {field.value && !/^https?:\/\/[^\s/$.?#].[^\s]*$/.test(field.value) && (
                      <span className="text-red-600">Please provide a valid URL.</span>
                    )}
                  </FormMessage>
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
          <Separator />

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

