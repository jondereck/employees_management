"use client";
import * as z from "zod";
import { EmployeeType } from "@prisma/client";
import { Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import axios from "axios";
import { useRouter, useParams } from "next/navigation";
import { AlertModal } from "@/components/modals/alert-modal";
import { useOrigin } from "@/hooks/use-origin";
import ImageUpload from "@/components/ui/image-upload";


const formSchema = z.object({
  name: z.string().min(1, {
    message: "Name is required"
  }),
  value: z.string().min(0),
});

type EmployeeTypeValues = z.infer<typeof formSchema>;

interface EmployeeTypeProps {
  initialData: EmployeeType | null;
}


export const EmployeeTypeForm = ({
  initialData
}: EmployeeTypeProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = initialData ? "Edit Employee Type" : "Create Employee Type";
  const description = initialData ? "Edit a Employee Type" : "Add new Employee Type";
  const toastMessage = initialData ? "Employee Type updated." : "Employee Type created.";
  const action = initialData ? "Save changes." : "Create";

  const params = useParams();
  const router = useRouter();
  
  const form = useForm<EmployeeTypeValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: '',
      value: '',
    }
  });



  const onSubmit = async (values: EmployeeTypeValues) => {
    try {
      setLoading(true);
      if (initialData) {
        await axios.patch(`/api/${params.departmentId}/employee_type/${params.employeeTypeId}`, values);
        
      } else {
        await axios.post(`/api/${params.departmentId}/employee_type`, values); ;
      }

      router.refresh();
      router.push(`/${params.departmentId}/employee_type`)


      toast({
        title: "Success!",
        description: toastMessage,
      })
    } catch (error:any) {
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
    }  finally {
      setLoading(false);
    }
  }


  const onDelete = async () => {
    try {
      setLoading(true);

      await axios.delete(`/api/${params.departmentId}/employee_type/${params.employeeTypeId}`);

      toast({
        title: "Success!",
        description: "Employee Type deleted."
      })

      router.refresh();
      router.push(`/${params.departmentId}/employee_type`)


    } catch (error) {
      toast({
        title: "Error!",
        description: "To remove this employee type, please make sure to first remove all employees associated with it."
      })
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }
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
         
          <div className="grid grid-cols-3 gap-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Employee type"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
               <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color Value</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-x-4">
                      <Input
                        disabled={loading}
                        placeholder="Value "
                        {...field}
                      />
                      <div className="border p-4 rounded-full"
                      style={{backgroundColor: field.value}}/>
                    </div>

                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button disabled={loading} className="ml-auto" type="submit">
            {action}
          </Button>
        </form>
      </Form>
      <Separator />
    </>
  );
}

