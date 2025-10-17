"use client";
import * as z from "zod";
import { Department } from "@prisma/client";
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
import { ApiAlert } from "@/components/api-alert";
import { useOrigin } from "@/hooks/use-origin";
import NeonUsageCard from "@/components/neon-usage-card";




interface SettingsFormProps {
  initialData: Department;
}

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Department name is required"
  }),
});

type SettingsFormValues = z.infer<typeof formSchema>;

export const SettingsForm = ({
  initialData
}: SettingsFormProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const router = useRouter();
  const origin = useOrigin();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
  });

  const onDelete = async () => {
    try {
      setLoading(true);

      await axios.delete(`/api/departments/${params.departmentId}`);

      toast({
        title: "Success!",
        description: "Department have been removed."
      })

      router.refresh();
      router.push("/");

    } catch (error) {
      toast({
        title: "Error!",
        description: "Remove all users to proceed."
      })
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = async (values: SettingsFormValues) => {
    try {
      setLoading(true);
      await axios.patch(`/api/departments/${params.departmentId}`, values);

      router.refresh();

      toast({
        title: "Success!",
        description: "Your changes have been saved."
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem with your request.",
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
          title="Settings"
          description="Manage your department preferences"
        />
        <Button
          disabled={loading}
          variant="destructive"
          size="icon"
          onClick={() => setOpen(true)}
        >
          <Trash className="h-4 w-4" />
        </Button>
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
                      placeholder="Department name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button disabled={loading} className="ml-auto" type="submit">
            Save Changes
          </Button>
        </form>
      </Form>
      <NeonUsageCard />
      <Separator />
      <ApiAlert 
        title="NEXT_PUBLIC_API_URL" 
        description={`${origin}/api/${params.departmentId}`} 
        variant="public"
      />
    </>
  );
}

