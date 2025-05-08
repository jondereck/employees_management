"use client"


import { Image as ImageType } from "../../../../employees/components/columns";

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
  {/* Tab List - Horizontal scroll on small screens */}
  <div className="mt-2 mb-4 px-2 overflow-x-auto">
    <Tab.List className="flex gap-2 min-w-max">
      {images.map((image) => (
        <Tab key={image.id} className="focus:outline-none shrink-0">
          {({ selected }) => (
            <div
              className={cn(
                "rounded-md overflow-hidden border transition-all duration-200 cursor-pointer w-16 h-16",
                selected
                  ? "ring-2 ring-primary border-primary"
                  : "border-muted hover:border-primary/50"
              )}
            >
              <Image
                src={image.url}
                alt="Thumbnail"
                width={64}
                height={64}
                className="object-cover w-full h-full"
              />
            </div>
          )}
        </Tab>
      ))}
    </Tab.List>
  </div>

  {/* Tab Panels */}
  <Tab.Panels className="w-full p-4">
    {images.map((image) => (
      <Tab.Panel key={image.id}>
        <div className="relative w-full max-w-sm mx-auto aspect-square overflow-hidden rounded-lg border bg-gray-100">
          <Image
            fill
            src={image.url}
            alt="Main Image"
            className="object-cover object-center"
          />
          {/* Logo */}
          <div className="absolute top-2 left-2 z-10">
            <Image
              src="https://res.cloudinary.com/ddzjzrqrj/image/upload/v1702523620/Lingayen-3-removebg-preview_lmhivo.png"
              alt="Company Logo"
              width={32}
              height={32}
              className="w-8 h-8"
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