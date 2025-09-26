"use client";
import * as z from "zod";
import { Billboard, Offices } from "@prisma/client";
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
import { AutoField } from "../../../employees/components/autofill";


const formSchema = z.object({
  name: z.string().min(1, {
    message: "Name is required"
  }),
  billboardId: z.string().min(1, {
    message: "Billboard is required"
  }),
  bioIndexCode: z.string().optional().transform(v => (v?.trim() ? v.trim() : undefined)),
});

type OfficeFormValues = z.infer<typeof formSchema>;

interface OfficeFormProps {
  initialData: Offices | null;
  billboards: Billboard[]
}


export const OfficeForm = ({
  initialData,
  billboards
}: OfficeFormProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = initialData ? "Edit Office" : "Create Office";
  const description = initialData ? "Edit a Office" : "Add new Office";
  const toastMessage = initialData ? "Office updated." : "Office created.";
  const action = initialData ? "Save changes" : "Create";

  const params = useParams();
  const router = useRouter();

  const form = useForm<OfficeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
        name: initialData.name ?? "",
        billboardId: (initialData as any).billboardId ?? "", // adjust if field exists
        bioIndexCode: initialData.bioIndexCode ?? "",        // NEW
      }
      : {
        name: "",
        billboardId: "",
        bioIndexCode: "",                                     // NEW
      },
  });



  const onSubmit = async (values: OfficeFormValues) => {
    try {
      setLoading(true);

      const payload = {
        ...values,
        bioIndexCode: values.bioIndexCode ?? null,
      };
      if (initialData) {
        await axios.patch(
          `/api/${params.departmentId}/offices/${params.officeId}`,
          payload
        );
      } else {
        await axios.post(`/api/${params.departmentId}/offices`, payload);
      }

      router.refresh();
      router.push(`/${params.departmentId}/offices`)


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

      await axios.delete(`/api/${params.departmentId}/offices/${params.officeId}`);

      router.push(`/${params.departmentId}/offices`)

      toast({
        title: "Success!",
        description: "Office deleted."
      })

    } catch (error) {
      toast({
        title: "Error!",
        description: "Make sure to remove all user associated with office to proceed."
      })
    } finally {
      setLoading(false);
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

          <div className="grid lg:grid-cols-2 grid-cols-1 gap-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Office name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
                 <FormField
              control={form.control}
              name="bioIndexCode"
              render={({ field }) => (
                <AutoField
                  kind="text"
                  label="BIO Index Code"
                  placeholder="e.g., 2050000"
                  description="Used to suggest BIO numbers. Offices can share the same code."
                  field={field}
                  nameSafe={false}
                  formatMode="upper"
                />
              )}
            />

            <FormField
              control={form.control}
              name="billboardId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billboard</FormLabel>
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
                          placeholder="Select billboard"
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {billboards.map((billboard) => (
                        <SelectItem
                          key={billboard.id}
                          value={billboard.id}
                        >
                          {billboard.label}
                        </SelectItem>
                      ))}
                    </SelectContent>

                  </Select>
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

