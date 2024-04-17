"use client"


import usePreviewModal from "../hooks/use-preview-modal";
import Gallery from "./gallery";
import Info from "./ui/info";
import Modal from "./ui/modal";

const PreviewModal = () => {
  const previewModal = usePreviewModal();
  const employee = usePreviewModal((state) => state.data);
  
  if (!employee) {
    return null;
  }
  
  return ( 
    <Modal
      open={previewModal.isOpen}
      onClose={previewModal.onClose}
    >
     <div className="grid w-full grid-cols-1 items-start gap-x-6 gap-y-8 sm:grid-cols-2 md:grid-cols-3 lg:gap-x-8">
        <div className="col-span-1">
          <Gallery images={employee.images}/>
        </div>
        <div className="sm:colspan-1 md:col-span-2 lg:col-span-2">
          <Info data={employee}/>
        </div>
      </div>
    </Modal>
   );
}
 
export default PreviewModal;