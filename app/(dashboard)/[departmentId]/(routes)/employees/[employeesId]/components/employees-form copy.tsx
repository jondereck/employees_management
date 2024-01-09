// "use client";
// import * as z from "zod";
// import { Eligibility, Employee, EmployeeType, Gender, Image, Offices } from "@prisma/client";
// import { CalendarIcon, Check, ChevronDown, Trash } from "lucide-react";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";

// import { Button } from "@/components/ui/button";
// import Heading from "@/components/ui/heading";
// import { Separator } from "@/components/ui/separator";
// import { useEffect, useState } from "react";
// import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
// import { Input } from "@/components/ui/input";
// import { toast } from "@/components/ui/use-toast";
// import axios from "axios";
// import { useRouter, useParams } from "next/navigation";
// import { AlertModal } from "@/components/modals/alert-modal";
// import ImageUpload from "@/components/ui/image-upload";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// import { Calendar } from "@/components/ui/calendar";
// import { cn } from "@/lib/utils";
// import { format } from "date-fns";
// import { Checkbox } from "@/components/ui/checkbox";
// import {
//   Command,
//   CommandEmpty,
//   CommandGroup,
//   CommandInput,
//   CommandItem,
// } from "@/components/ui/command"




// const formSchema = z.object({
//   houseNo: z.string(),
  
// });


// type EmployeesFormValues = z.infer<typeof formSchema>;

// interface EmployeesFormProps {
//   initialData: Employee & {
//     images: Image[]
//   } | null;
//   offices: Offices[];
//   eligibility: Eligibility[];
//   employeeType: EmployeeType[];
// }


// export const EmployeesForm = ({
//   initialData,
//   offices,
//   eligibility,
//   employeeType,
// }: EmployeesFormProps) => {
//   const [open, setOpen] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [inputSearchOpen, setInputSearchOpen] = useState(false);



//   const [value, setValue] = useState("")



//   // const fetchProvinces = async () => {
//   //   try {
//   //     if (selectedRegion) {
//   //       const response = await axios.get(`/api/geo?action=provinces&regionId=${selectedRegion}`);
//   //       setProvinces(response.data);
//   //     }
//   //   } catch (error) {
//   //     console.error("Error fetching provinces", error);
//   //   }
//   // };

//   const title = initialData ? "Edit Employee" : "Create Employee";
//   const description = initialData ? "Edit a Employee" : "Add new Employee";
//   const toastMessage = initialData ? "Employee updated." : "Employee created.";
//   const action = initialData ? "Save changes." : "Create";

//   const params = useParams();
//   const router = useRouter();




//   const form = useForm<EmployeesFormValues>({
//     resolver: zodResolver(formSchema),
//     defaultValues: initialData ? {
//       ...initialData,
     
//     }

//       : {

//         houseNo: '',
     
//       }
//   });



//   const onSubmit = async (values: EmployeesFormValues) => {
//     try {
//       setLoading(true);

//       if (initialData) {
//         await axios.patch(`/api/${params.departmentId}/employees/${params.employeesId}`, values);

//       } else {
//         await axios.post(`/api/${params.departmentId}/employees`, values);;
//       }

//       router.refresh();
//       router.back();


//       toast({
//         title: "Success!",
//         description: toastMessage,
//       })
//     } catch (error: any) {
//       if (error.response && error.response.data && error.response.data.error) {
//         // Handle API error messages
//         const errorMessage = error.response.data.error;
//         toast({
//           variant: "destructive",
//           title: "Uh oh! Something went wrong.",
//           description: errorMessage,
//         });
//       } else {
//         // Handle generic error
//         toast({
//           variant: "destructive",
//           title: "Uh oh! Something went wrong.",
//           description: "There was a problem with your request.",
//         });
//       }
//     } finally {
//       setLoading(false);
//     }
//   }


//   const onDelete = async () => {
//     try {
//       setLoading(true);

//       await axios.delete(`/api/${params.departmentId}/employees/${params.employeesId}`);

//       toast({
//         title: "Success!",
//         description: "Employee deleted."
//       })

//       router.refresh();
//       router.push(`/${params.departmentId}/employees`)


//     } catch (error) {
//       toast({
//         title: "Error!",
//         description: "Remove all users to proceed."
//       })
//     } finally {
//       setLoading(false);
//     }
//   }

//   const currentYear = new Date().getFullYear();
//   const fromYear = currentYear - 74;


//   const genderOptions = Object.values(Gender);
//   return (
//     <>
//       <AlertModal
//         isOpen={open}
//         onClose={() => setOpen(false)}
//         onConfirm={onDelete}
//         loading={loading}
//       />
//       <div className="flex items-center justify-between">
//         <Heading
//           title={title}
//           description={description}
//         />
//         {initialData && (
//           <Button
//             disabled={loading}
//             variant="destructive"
//             size="icon"
//             onClick={() => setOpen(true)}
//           >
//             <Trash className="h-4 w-4" />
//           </Button>
//         )}
//       </div >
//       <Separator />
//       <Form {...form} >
//         <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 w-full">
//         <div className="grid lg:grid-cols-2 grid-cols-1 gap-4">
//           <FormField
//               control={form.control}
//               name="houseNo"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Region</FormLabel>
//                   <FormControl>
//                     <Input
//                       disabled={loading}
//                       placeholder="03"
//                       {...field}
//                     />
//                   </FormControl>
//                   <FormDescription>
//                     This Information is private
//                   </FormDescription>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />
//              <FormField
//               control={form.control}
//               name="houseNo"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Province</FormLabel>
//                   <FormControl>
//                     <Input
//                       disabled={loading}
//                       placeholder=""
//                       {...field}
//                     />
//                   </FormControl>
//                   <FormDescription>
//                   </FormDescription>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />
//                         <FormField
//               control={form.control}
//               name="houseNo"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>City/Municipal</FormLabel>
//                   <FormControl>
//                     <Input
//                       disabled={loading}
//                       placeholder=""
//                       {...field}
//                     />
//                   </FormControl>
//                   <FormDescription>
//                   </FormDescription>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />
          
//                <FormField
//               control={form.control}
//               name="houseNo"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Barangay</FormLabel>
//                   <FormControl>
//                     <Input
//                       disabled={loading}
//                       placeholder=""
//                       {...field}
//                     />
//                   </FormControl>
//                   <FormDescription>
//                   </FormDescription>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

        
//             <FormField
//               control={form.control}
//               name="houseNo"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Unit/Number</FormLabel>
//                   <FormControl>
//                     <Input
//                       disabled={loading}
//                       placeholder="03"
//                       {...field}
//                     />
//                   </FormControl>
//                   <FormDescription>
//                     This Information is private
//                   </FormDescription>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />
//             <FormField
//               control={form.control}
//               name="houseNo"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Street</FormLabel>
//                   <FormControl>
//                     <Input
//                       disabled={loading}
//                       placeholder=""
//                       {...field}
//                     />
//                   </FormControl>
//                   <FormDescription>
//                   </FormDescription>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

         
//           </div>

//           <Separator />
//           <Button disabled={loading} className="ml-auto" type="submit">
//             {action}
//           </Button>
//         </form>
//       </Form>

//     </>
//   );
// }

