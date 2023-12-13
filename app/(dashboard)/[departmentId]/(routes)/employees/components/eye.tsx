"use client"
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { MouseEventHandler, useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Archive, Copy, Edit, EyeIcon, MoreHorizontal, Trash } from "lucide-react";
import toasts from "react-hot-toast";
import { toast } from "@/components/ui/use-toast";
import { ApiAlert } from "@/components/api-alert";
import { AlertModal } from "@/components/modals/alert-modal";
import { EmployeesColumn } from "./columns";
import usePreviewModal from "../../(frontend)/view/hooks/use-preview-modal";
import { Employees } from "../../(frontend)/view/types";
import usePreviewModal2 from "../../(frontend)/view/hooks/use-preview-modal2";



interface EyeProps {
  data: EmployeesColumn;
}

export const Eye = ({
  data
}: EyeProps) => {
  const router = useRouter();
  const params = useParams();
  const previewModal = usePreviewModal2();


  const onPreview: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    previewModal.onOpen(data);
  }

  
  return (
    <>
      <Button
        variant="ghost"
        onClick={onPreview}
      >
        <EyeIcon />
      </Button>


    </>
  );
}