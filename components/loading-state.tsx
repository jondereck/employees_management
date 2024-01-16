"use client";

import Image from "next/image";
import { PuffLoader } from "react-spinners";

const LoadingState = () => {
  return (
    <div className="h-full flex flex-col items-center
    justify-center gap-y-4  ">
      {/* <PuffLoader 
        size={100}
        color="red"
      /> */}

      <div className="w-16 h-16  animate-spin">
        <Image
          fill
          alt="logo"
          src={'https://res.cloudinary.com/ddzjzrqrj/image/upload/v1702523620/Lingayen-3-removebg-preview_lmhivo.png'}
        />
      </div>
    </div>
  );
}

export default LoadingState;