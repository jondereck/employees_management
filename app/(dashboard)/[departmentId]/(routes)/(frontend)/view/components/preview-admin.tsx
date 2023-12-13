"use client"


import usePreviewModal from "../hooks/use-preview-modal";
import usePreviewModal2 from "../hooks/use-preview-modal2";
import Gallery from "./gallery";
import Info from "./ui/info";
import Modal from "./ui/modal";

const PreviewModal2 = () => {
  const previewModal = usePreviewModal2();
  const employee = usePreviewModal2((state) => state.data);
  
  if (!employee) {
    return null;
  }
  
  return ( 
    <Modal
      open={previewModal.isOpen}
      onClose={previewModal.onClose}
    >
      <div className="grid w-full grid-cols-1 items-start gap-x-6 gap-y-8 sm:grid-cols-12 lg:gap-x-8">
        <div className="sm:col-span-4 lg:col-span-5">
          <Gallery images={employee.images}/>
        </div>
        <div className="sm:colspan-8 lg:col-span-7">
          <Info data={employee}/>
        </div>
      </div>
    </Modal>
   );
}
 
export default PreviewModal2;