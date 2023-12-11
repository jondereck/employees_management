"use client";

import { PuffLoader } from "react-spinners";

const LoadingState = () => {
  return (  
    <div className="h-full flex flex-col  justify-center items-center">
      <PuffLoader 
        size={100}
        color="red"
      />
    </div>
  );
}
 
export default LoadingState;