"use client";
import * as z from "zod";
import { Eligibility, Employee, EmployeeType, Gender, Image, Offices } from "@prisma/client";
import { CalendarIcon, Trash } from "lucide-react";
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
  }),
  firstName: z.string().min(1, {
    message: "First Name is required"
  }),
  middleName: z.string().min(1, {
    message: "Middle Name is required"
  }),
  gender: z.string().min(0, {
    message: "Gender is required"
  }),
  employeeTypeId: z.string().min(1, {
    message: "Appointment  is required"
  }),
  officeId: z.string().min(1, {
    message: "Office is required"
  }),
  eligibilityId: z.string().min(1, {
    message: "Eligibility is required"
  }),

  suffix: z.string(),
  images: z.object({ url: z.string() }).array(),
  contactNumber: z.string(),

  position: z.string().min(1, {
    message: "Position is required"
  }),
  salary: z.coerce.number().min(1),
  birthday: z.date(),
  // age: z.string(),
  gsisNo: z.string().length(10, {
    message: "GSIS No should be exactly 10 digits long"
  }),
  pagIbigNo: z.string().length(12, {
    message: "Pagibig No. should be exactlyy 12 digits long"
  }),
  tinNo: z.string().length(9, {
    message: "TIN No. should be exactly 9 digits long."
  }),
  philHealthNo: z.string().length(12, {
    message: "Philhealth No. should be exactly 12 digits long."
  }),
  dateHired: z.date(),
  isFeatured: z.boolean(),
  isArchived: z.boolean(),




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
      salary: parseFloat(String(initialData?.salary))
    }

      : {
        lastName: '',
        firstName: '',
        middleName: '',
        suffix: '',
        images: [],
        gender: Gender.Male,
        contactNumber: 's',
        position: '',
        birthday: new Date(),
        // age: '',
        gsisNo: '',
        tinNo: '',
        pagIbigNo: '',
        philHealthNo: '',
        salary: 0.00,
        dateHired: new Date(),
        isFeatured: false,
        isArchived: false,
        employeeTypeId: '',
        officeId: '',
        eligibilityId: '',

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
      return age   ;
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
      if (initialData) {
        await axios.patch(`/api/${params.departmentId}/employees/${params.employeesId}`, values);

      } else {
        await axios.post(`/api/${params.departmentId}/employees`, values);;
      }

      router.refresh();
      router.push(`/${params.departmentId}/employees`)


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

  const genderOptions = Object.values(Gender);
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
          <div className="grid grid-cols-3 gap-8">
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
                <FormItem>
                  <FormLabel>Date of birth</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn("flex justify-start text-left font-normal", !field.value && "text-muted-foreground")}
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
                        fromYear={1920}
                        toYear={2030}
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



          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-8">

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
                    <SelectContent>
                      {offices.map((item) => (
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
                          {item.customType}
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
          <div className="grid grid-cols-2 gap-8">
            <FormField
              control={form.control}
              name="gsisNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GSIS Number</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Ex: 0000000000"
                      {...field}
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
                        className={cn("w-[240px] justify-start text-left font-normal", !field.value && "text-muted-foreground")}
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
                        fromYear={1920}
                        toYear={2030}
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
          <div className="grid grid-cols-2 gap-8 ">
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

