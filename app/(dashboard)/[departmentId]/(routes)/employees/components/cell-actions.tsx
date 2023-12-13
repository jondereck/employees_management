"use client"
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { MouseEventHandler, useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Archive, Copy, Edit, MoreHorizontal, Trash, View } from "lucide-react";
import toasts from "react-hot-toast";
import { toast } from "@/components/ui/use-toast";
import { ApiAlert } from "@/components/api-alert";
import { AlertModal } from "@/components/modals/alert-modal";
import { EmployeesColumn } from "./columns";
import usePreviewModal from "../../(frontend)/view/hooks/use-preview-modal";




interface CellActionProps {
  data: EmployeesColumn;
}

export const CellAction = ({
  data
}: CellActionProps) => {
  const router = useRouter();
  const params = useParams();

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const previewModal = usePreviewModal();

  // const onPreview = () => {
  //   previewModal.onOpen(data);
  // }




  const onCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    toasts.success("Succefully copied.")

  }


  const onView = async () => {
    try {
      setLoading(true);
      router.push(`/${params.departmentId}/view/employee/${data?.id}`)

    } catch (error) {
      toast({
        title: "Error!",
        description: "Failed to archive employee."
      });
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async () => {
    try {
      setLoading(true);


      await axios.delete(`/api/${params.departmentId}/employees/${data.id}`);

      toast({
        title: "Success!",
        description: "Employee deleted."
      })

      window.location.reload();

    } catch (error) {
      toast({
        title: "Error!",
        description: "To remove this Employee, please make sure to first remove all offices associated with it."


      })
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  const onArchive = async () => {
    try {
      setLoading(true);
      await axios.put(`/api/${params.departmentId}/archive/${data.id}`);
      toast({
        title: "Succes!",
        description: "Employee archived"
      });

      router.refresh();

    } catch (error) {
      toast({
        title: "Error!",
        description: "Failed to archive employee."
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(!open)}
        onConfirm={onConfirm}
        loading={loading}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only"> Open Menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onCopy(data.id)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Id
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onView}>
            <View
              className="mr-2 h-4 w-4" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/${params.departmentId}/employees/${data.id}`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Update
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Trash
              className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>


        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}