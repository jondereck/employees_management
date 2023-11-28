"use client";

import { useEffect, useState } from "react";
import PreviewModal from "../view/components/preview";



const ModalProvider = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  },[]);

  if(!isMounted) {
    return null;
  }

  return (  
    <>
    <PreviewModal/>
    </>
  );
}
 
export default ModalProvider;