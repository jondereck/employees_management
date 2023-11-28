"use client"

import Image from "next/image";
import { Employees } from "../../types";
import IconButton from "./icon-button";
import { Edit, Expand } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { MouseEventHandler, useEffect, useState } from "react";
import usePreviewModal from "../../hooks/use-preview-modal";


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


  return ( 
  <div 
    onClick={handleClick}
    className="bg-white group cursor-pointer rounded-xl border p-3 space-y-4">
    <div className="aspect-square rounded-xl bg-gray-100 relative">
      <Image 
        src={data?.images?.[0]?.url}
        fill
        alt="Image"
        className="aspect-square object-cover rounded-md"
      />
      <div className="opacity-0 group-hover:opacity-100 transition absolute w-full px-6 bottom-5">
        <div className="flex gap-x-6  justify-center">
        <IconButton
          onClick={onPreview}
          icon={<Expand  size={20} className="text-gray-600" />}
        />
         <IconButton
             onClick={handleEdit}
          icon={<Edit  size={20} className="text-gray-600" />}
        />
        </div>
      </div>
    </div>
    {/* description */}
    <div>
      <p className="font-semibold text-lg">{data.firstName} {data.lastName}</p>
      <p className="font-light text-sm text-gray-500">{data.position}</p>
   
      {/* {age !== null && (
        <p className="semi-bold text-lg">{`Age: ${age} years`}</p>
      )} */}
    </div>
    <div>
     
    </div>
  </div> );
}
 
export default EmployeeCard;