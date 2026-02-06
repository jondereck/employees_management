"use client";

import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";
import { Fragment } from "react";
import IconButton from "./icon-button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  children,
}) => {
  return (
    <Transition show={open} appear as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0"
        onClose={onClose}
      >
        {/* BACKDROP */}
        <div className="fixed inset-0 bg-black/50" />

        {/* MODAL WRAPPER */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">

            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-2xl">
                <div className="relative max-h-[90vh] overflow-y-auto px-4 pb-8 pt-14 sm:px-6 sm:pt-8 md:p-6 lg:p-8">
                  
                  {/* CLOSE BUTTON */}
                  <div className="absolute right-4 top-4 z-10">
                    <IconButton onClick={onClose} icon={<X size={15} />} />
                  </div>

                  {children}
                </div>
              </Dialog.Panel>
            </Transition.Child>

          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default Modal;
