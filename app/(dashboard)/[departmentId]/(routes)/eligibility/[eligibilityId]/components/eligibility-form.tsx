"use client";
import * as z from "zod";
import { Eligibility, EligibilityTypes } from "@prisma/client";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const formSchema = z.object({
  customType: z.string().min(0),
  eligibilityTypes: z.string().min(0, {
    message: "Name is required"
  }),
  value: z.string().min(4).regex(/^#/, {
    message: 'Make sure you enter a valid hex code'
  }),
});

type EligibilityValues = z.infer<typeof formSchema>;

interface EligibilityProps {
  initialData: Eligibility | null;

}


export const EligibilityForm = ({
  initialData,

}: EligibilityProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = initialData ? "Edit Eligibility Type" : "Create Eligibility Type";
  const description = initialData ? "Edit a Eligibility Type" : "Add new Eligibility Type";
  const toastMessage = initialData ? "Eligibility Type updated." : "Eligibility Type created.";
  const action = initialData ? "Save changes." : "Create";

  const params = useParams();
  const router = useRouter();

  const form = useForm<EligibilityValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      eligibilityTypes: EligibilityTypes.None,
      customType: '',
      value: '',
    }
  });

  const eligibilityTypeOptions = Object.values(EligibilityTypes)

  const onSubmit = async (values: EligibilityValues) => {
    try {
      setLoading(true);
      if (initialData) {
        await axios.patch(`/api/${params.departmentId}/eligibility/${params.eligibilityId}`, values);

      } else {
        await axios.post(`/api/${params.departmentId}/eligibility`, values);;
      }

      router.refresh();
      router.push(`/${params.departmentId}/eligibility`)


      toast({
        title: "Success!",
        description: toastMessage,
      })
    }  catch (error:any) {
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
              name="customType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Eligibility</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Eligibility name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* <FormField
              control={form.control}
              name="eligibilityTypes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Eligibility Type</FormLabel>
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
                          placeholder="Select default eligibility"
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {eligibilityTypeOptions.map((item) => (
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
            /> */}
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

