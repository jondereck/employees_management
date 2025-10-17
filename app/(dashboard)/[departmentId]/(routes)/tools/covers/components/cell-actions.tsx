"use client";

import axios from "axios";
import { useParams } from "next/navigation";
import { useState } from "react";

import { AlertModal } from "@/components/modals/alert-modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { useToolsNavigation } from "@/components/tools/navigation-provider";
import { Copy, Edit, MoreHorizontal, Trash } from "lucide-react";
import toasts from "react-hot-toast";

import { BillboardColumn } from "./columns";

interface CellActionProps {
  data: BillboardColumn;
}

export const CellAction = ({ data }: CellActionProps) => {
  const params = useParams();
  const { navigate } = useToolsNavigation();

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const onCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    toasts.success("Succefully copied.");
  };

  const onConfirm = async () => {
    try {
      setLoading(true);

      await axios.delete(`/api/${params.departmentId}/billboards/${data.id}`);

      toast({
        title: "Success!",
        description: "Billboards deleted.",
      });

      window.location.reload();
    } catch (error) {
      toast({
        title: "Error!",
        description:
          "To remove this billboard, please make sure to first remove all offices associated with it.",
      });
    } finally {
      setLoading(false);
      setOpen(false);
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
          <DropdownMenuItem onClick={() => navigate(`/${params.departmentId}/tools/covers/${data.id}`)}>
            <Edit className="mr-2 h-4 w-4" />
            Update
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
