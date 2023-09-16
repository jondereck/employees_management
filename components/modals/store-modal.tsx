"use client";

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios";

import useStoreModal from "@/hooks/use-store-modal";
import Modal from "../ui/modal";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useState } from "react";
import { toast } from "../ui/use-toast";



const formSchema = z.object({
  name: z.string().min(1).optional()
})

const StoreModal = () => {
  const storeModal = useStoreModal();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: ""
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsLoading(true)

      const response = await axios.post('/api/departments', values);
      
      toast({
        title: "Success",
        description: "New Department created."
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem with your request.",
      })
    } finally {
      setIsLoading(false)
    }
  }
  return (
    <Modal
      title="Create "
      description="Add new  "
      isOpen={storeModal.isOpen}
      onClose={storeModal.onClose}
    >
      <div>
        <div className="space-y-4 py-2 pb-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading} placeholder="Department" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-6 space-x-2 flex items-center justify-end w-full">
                <Button
                  disabled={isLoading}
                  variant="outline"
                  onClick={storeModal.onClose}
                >Cancel
                </Button>
                <Button  disabled={isLoading}type="submit">Continue</Button>
              </div>

            </form>
          </Form>
        </div>
      </div>
    </Modal>
  );
}

export default StoreModal;