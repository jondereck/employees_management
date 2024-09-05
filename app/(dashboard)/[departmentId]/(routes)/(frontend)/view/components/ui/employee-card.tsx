"use client"

import Image from "next/image";
import { Employees } from "../../types";
import IconButton from "./icon-button";
import { Crown, CrownIcon, Edit, Expand } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { MouseEventHandler, useEffect, useState } from "react";
import usePreviewModal from "../../hooks/use-preview-modal";
import { cn } from "@/lib/utils";
import { StarFilledIcon } from "@radix-ui/react-icons";
import { ActionTooltip } from "@/components/ui/action-tooltip";


interface EmployeeCardProps {
  data: Employees;
}

const EmployeeCard = ({
  data,
}: EmployeeCardProps) => {
  const router = useRouter();
  const params = useParams();
  const previewModal = usePreviewModal();

  const onPreview: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    previewModal.onOpen(data);

  }

  const handleClick = () => {
    router.push(`/${params.departmentId}/view/employee/${data?.id}`)
  }

  const handleEdit: MouseEventHandler<HTMLButtonElement> =
    (event) => {
      event.stopPropagation();
      router.push(`/${params.departmentId}/employees/${data.id}`)
    }

  const middleInitials = () => {
    let middleNameInitials = ''

    if (data.middleName) {
      const middleNameWords = data.middleName.split(' ');
        middleNameInitials = middleNameWords.map(word => word.charAt(0).toUpperCase()).join('.') + '.';
    }

    return middleNameInitials;
  }

  


  return (
    <div
      onClick={handleClick}
      className={cn(`bg-white group cursor-pointer rounded-xl border p-3 space-y-4 `, data.isHead ? 'border ' : '')}>
      <div className="aspect-square rounded-xl bg-gray-100 relative">
        <Image
          src={data?.images?.[0]?.url}
          fill
          alt="Image"
          className={cn("object-cover object-center rounded-md h-full w-full")}
        />
        <ActionTooltip
          label="Executive Level"
          side="left"
        >
        <div className={cn(`${data.isHead && 'absolute w-full left-0 top-0'}`)}>
          {data.isHead && <IconButton icon={<StarFilledIcon className="text-yellow-600" />}
          />}
        </div> 
        </ActionTooltip>
        <div className="opacity-0 group-hover:opacity-100 transition absolute w-full px-6 bottom-5 ">
          <div className="flex gap-x-6  justify-center">
            <IconButton
              onClick={onPreview}
              icon={<Expand size={20} className="text-gray-600" />}
            />
            <IconButton
              onClick={handleEdit}
              icon={<Edit size={20} className="text-gray-600 " />}
            />
          </div>
        </div>
      </div>
      {/* description */}
      <div>
        <p className="font-semibold text-lg">{data.firstName} {middleInitials()} {data.lastName}</p>
        <p className="font-light text-sm text-gray-500">{data.position}</p>
        {/* {age !== null && (
        <p className="semi-bold text-lg">{`Age: ${age} years`}</p>
      )} */}
      </div>
      <div>

      </div>
    </div>);
}

export default EmployeeCard;