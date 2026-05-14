"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";

interface ModalProps {
  title: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  hideDefaultHeader?: boolean;
  onContentScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

const Modal = ({
  title,
  description,
  isOpen,
  onClose,
  children,
  className,  
  contentClassName,
  headerClassName,
  bodyClassName,
  hideDefaultHeader,
  onContentScroll,
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
  className={cn(
    "w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6",
    className,          // 👈 allow external override
    contentClassName    // 👈 keep backward compatibility
  )}
        // iOS smooth scrolling
        style={{ WebkitOverflowScrolling: "touch" }}
        onScroll={onContentScroll}
      >
        {!hideDefaultHeader ? (
          <DialogHeader className={headerClassName}>
            <DialogTitle className="mt-6">{title}</DialogTitle>
            <DialogDescription>
              {description}
            </DialogDescription>
          </DialogHeader>
        ) : null}
        <div className={cn(bodyClassName)}>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Modal;
