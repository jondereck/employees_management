"use client"
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { MouseEventHandler, useEffect, useState, useTransition } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Archive, Copy, Edit, Eye, FileIcon, MoreHorizontal, Trash, View } from "lucide-react";
import toasts from "react-hot-toast";
import { toast } from "@/components/ui/use-toast";
import { ApiAlert } from "@/components/api-alert";
import { AlertModal } from "@/components/modals/alert-modal";

import usePreviewModal from "../../(frontend)/view/hooks/use-preview-modal";
import { Employees } from "../../(frontend)/view/types";
import { EmployeesColumn } from "./columns";
import Loading from "@/app/loading";





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
  const [isPending, startTransition] = useTransition();
  const [dropdownOpen, setDropdownOpen] = useState(false);




  const onCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    toasts.success("Succefully copied.")

  }
 
const onView = () => {
  startTransition(() => {
    router.push(`/${params.departmentId}/view/employee/${data.id}`);
  });
};

  const onUpdate = async () => {
    try {
      startTransition(() => {
        router.push(`/${params.departmentId}/employees/${data.id}`);
      });
    } catch (error) {
      toast({
        title: "Error!",
        description: "Failed to update employee."
      });
    } finally {
      setLoading(false);
    }
  };


 const handleCloseModal = () => {
    setLoading(false);
    setOpen(false);
  };

  const onConfirm = async () => {
    try {
      setLoading(true);

      await axios.delete(`/api/${params.departmentId}/employees/${data.id}`);

      toast({
        title: "Success!",
        description: "Employee deleted."
      });

      window.location.reload(); // or router.refresh() if you're using the App Router

    } catch (error) {
      toast({
        title: "Error!",
        description: "To remove this Employee, please make sure to first remove all offices associated with it."
      });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };


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

  const openDeleteModal = () => {
    setDropdownOpen(false);
    // Small delay to let dropdown close animation complete
    setTimeout(() => {
      setOpen(true);
    }, 150); // 150ms works for most UI kits
  };

  return (
    <>
      {/* Global loading overlay */}
      {(loading || isPending) && <Loading />}

      <AlertModal
        isOpen={open}
        onClose={handleCloseModal}
        onConfirm={onConfirm}
        loading={loading}
      />

      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open Menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>

          <DropdownMenuItem onClick={() => onCopy(data.id)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Id
          </DropdownMenuItem>

          {data.employeeLink && (
            <DropdownMenuItem onClick={() => window.open(data.employeeLink, "_blank")}>
              <FileIcon className="mr-2 h-4 w-4" />
              View File
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onUpdate}>
            <Edit className="mr-2 h-4 w-4" />
            Update
          </DropdownMenuItem>

          <DropdownMenuItem onClick={openDeleteModal}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}