"use client";

import { useEffect, useState } from "react";
import usePreviewModal from "../hooks/use-preview-modal";
import Gallery from "./gallery";
import Info from "./ui/info";
import Modal from "./ui/modal";
import getEmployee from "../actions/get-employee";
import { Employees } from "../types";

const PreviewModal = () => {
  
  const previewModal = usePreviewModal();
  const previewEmployee = usePreviewModal((state) => state.data);

  const [employee, setEmployee] = useState<Employees | null>(null);

  useEffect(() => {
    if (!previewEmployee?.id) return;

    getEmployee(previewEmployee.id).then(setEmployee);
  }, [previewEmployee?.id]);

  if (!employee) return null;

  return (
    <Modal open={previewModal.isOpen} onClose={previewModal.onClose}>
      <div className="grid w-full grid-cols-1 items-start gap-x-6 gap-y-8 sm:grid-cols-2 md:grid-cols-3 lg:gap-x-8">
        <div className="col-span-1">
          <Gallery
            images={employee.images ?? []}
            employeeId={employee.id}
            employeeNo={employee.employeeNo ?? ""}
            gender={employee.gender as "Male" | "Female" | undefined} // ✅ pass gender
          />
        </div>
        <div className="sm:col-span-1 md:col-span-2 lg:col-span-2">
          
          <Info data={employee} />
        </div>
      </div>
    </Modal>
  );
};

export default PreviewModal;
