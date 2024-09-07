"use client"
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { MouseEventHandler, useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Archive, Copy, Edit, ExpandIcon, EyeIcon, MoreHorizontal, Trash } from "lucide-react";
import toasts from "react-hot-toast";
import { toast } from "@/components/ui/use-toast";
import { ApiAlert } from "@/components/api-alert";
import { AlertModal } from "@/components/modals/alert-modal";
// import { EmployeesColumn } from "./columns";
import usePreviewModal from "../../(frontend)/view/hooks/use-preview-modal";
import { Employees } from "../../(frontend)/view/types";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import IconButton from "../../(frontend)/view/components/ui/icon-button";
import { EmployeesColumn } from "./columns";


interface EyeProps {
  data: EmployeesColumn;
}

export const Eye = ({
  data
}: EyeProps) => {
  const router = useRouter();
  const params = useParams();
  const previewModal = usePreviewModal();

  const [loading, setLoading] = useState(false);
  // const [isMounted, setIsMounted] = useState(false);

  // useEffect(() => {
  //   setIsMounted(true);
  // },[]);

  // if(!isMounted) {
  //   return null;
  // }

  const onPreview: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    previewModal.onOpen(data);
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

  return (
    <ActionTooltip
      label="Preview"
      side="top"
    >
      <IconButton
        onClick={onPreview}
        icon={<ExpandIcon size={12} className="text-gray-600" />}
      />
    </ActionTooltip>
  );
}