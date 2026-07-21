"use client";

import { useState } from "react";
import { Copy, Edit, MoreHorizontal, Trash } from "lucide-react";

import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { OfficesColumn } from "./columns";
import { toast } from "@/components/ui/use-toast";
import toast2 from "react-hot-toast";
import { OfficeDeletionModal } from "./office-deletion-modal";

interface CellActionProps {
  data: OfficesColumn;
}

export const CellAction = ({
  data,
}:CellActionProps) => {
  const router = useRouter();
  const params = useParams();
  const [open, setOpen] = useState(false);
  const departmentId = String(params.departmentId);

  const onDeleted = () => {
    toast({
      title: "Success!",
      description: "Office deleted",
    });
    router.refresh();
  };

  const onCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    toast2.success('Succesfully copied to clipboard.');
  }


  
  return (
    <>
      <OfficeDeletionModal
        isOpen={open} 
        onClose={() => setOpen(false)}
        departmentId={departmentId}
        officeId={data.id}
        officeName={data.name}
        onDeleted={onDeleted}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => onCopy(data.id)}
          >
            <Copy className="mr-2 h-4 w-4" /> Copy Id
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/${params.departmentId}/offices/${data.id}`)}
          >
            <Edit className="mr-2 h-4 w-4" /> Update
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setOpen(true)}
          >
            <Trash className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};