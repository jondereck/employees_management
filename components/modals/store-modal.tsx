"use client";

import useStoreModal from "@/hooks/use-store-modal";
import Modal from "../ui/modal";

const StoreModal = () => {
  const storeModal = useStoreModal();
  return (
    <Modal
      title="Create "
      description="Add new  "
      isOpen={storeModal.isOpen}
      onClose={storeModal.onClose}
    >
      future
    </Modal>
  );
}

export default StoreModal;