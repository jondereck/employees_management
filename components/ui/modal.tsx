"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";

interface ModalProps {
  title: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode
}

const Modal = ({
  title,
  description,
  isOpen,
  onClose,
  children
}: ModalProps) => {

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }
  const onChange = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onChange}>
     <DialogContent
    className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6"
    // iOS smooth scrolling
    style={{ WebkitOverflowScrolling: "touch" }}
  >
        <DialogHeader>
          <DialogTitle className="mt-6">{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <div>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Modal;