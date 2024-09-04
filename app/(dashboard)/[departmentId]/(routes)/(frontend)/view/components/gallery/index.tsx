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
          <Tab.Panel key={image.id}>
            <div
              className="aspect-square relative h-full w-full sm:rounded-lg overflow-hidden">
              <Image 
                    fill 
                    src={image.url}
                    alt="Image"
                    // style={{ width: '100%', height: '100%' }}
                     className={cn(
                "object-cover object-center rounded-xl border-2 bg-gray-100",
                image.value   && "border-4",
              )}
/>
              {/* Company Logo */}
              <div className="absolute top-0 left-0 m-4">
                <Image
                  src="https://res.cloudinary.com/ddzjzrqrj/image/upload/v1702523620/Lingayen-3-removebg-preview_lmhivo.png"
                  alt="Company Logo"
                  className="w-16 h-16"
                  width="20"
                  height="20"
                />
              </div>
            </div>
          </Tab.Panel>
        ))}
      </Tab.Panels>
    </Tab.Group>
  );
}

export default Gallery;