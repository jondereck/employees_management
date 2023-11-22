"use client"

import { EmployeeType, Image as ImageType } from "../../../view/types"; 
import { Tab } from "@headlessui/react";
import GalleryTab from "./gallery-tab";
import Image from "next/image";
import { cn } from "@/lib/utils";


interface GalleryProps {
  images: ImageType[];
}

const Gallery = ({
  images,
}: GalleryProps) => {
  const hexToRgba = (hex: string, alpha: number = 1) => {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  };
  return ( 
    <Tab.Group as="div" className="flex flex-col-reverse">
      <div className="mx-auto mt-6 hidden w-full max-w-2xl sm:block lg:max-w-none">
      <Tab.List className="grid grid-cols-4 gap-6">
        {images.map((image) => (
          <GalleryTab 
            key={image.id}
            image={image}
          />
        ))}
      </Tab.List>
      </div>
      <Tab.Panels className="aspect-square w-full" >
          {images.map((image, appointment) => (
            <Tab.Panel key={image.id} >
                <div className="aspect-square relative h-full w-full sm:rounded-lg overflow-hidden">
                  <Image 
                    fill 
                    src={image.url}
                    alt="Image"
                    // style={{ width: '100%', height: '100%' }}
                     className={cn(
                "object-cover object-center rounded-xl bg-gray-100",
                image.value   && "border-4",
              )}
/>
             
                </div>
            </Tab.Panel>
          ))}
      </Tab.Panels>
    </Tab.Group>
  );
}
 
export default Gallery;