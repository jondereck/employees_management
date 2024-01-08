"use client";

import { useEffect, useState } from "react";
import PreviewModal from "../view/components/preview";
import PreviewModal2 from "../../employees/components/preview-admin";



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
    <PreviewModal2/>
    </>
  );
}
 
export default ModalProvider;