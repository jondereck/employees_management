"use client";

import { useEffect, useState } from "react";
import usePreviewModal from "../hooks/use-preview-modal";
import Gallery from "./gallery";
import Info from "./ui/info";
import Modal from "./ui/modal";
import getEmployee from "../actions/get-employee";
import { Employees } from "../types";
import { EmployeesColumn } from "../../../employees/components/columns";


const PreviewModal = () => {
  const previewModal = usePreviewModal();

  // FAST data from table
  const previewEmployee = usePreviewModal(
    (state) => state.previewData
  ) as EmployeesColumn | undefined;

  // FULL data from API
  const [employee, setEmployee] = useState<Employees | null>(null);
  const [loading, setLoading] = useState(false);

  // 🔥 RESET local state when switching employees
  useEffect(() => {
    setEmployee(null);
  }, [previewEmployee?.id]);

  // Fetch full data AFTER modal opens
  useEffect(() => {
    if (!previewModal.isOpen || !previewEmployee?.id) return;

    setLoading(true);
    getEmployee(previewEmployee.id)
      .then(setEmployee)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [previewModal.isOpen, previewEmployee?.id]);

  // 🚀 Optimistic render: full data if ready, else preview data
  const dataToRender = employee ?? previewEmployee;

  if (!previewModal.isOpen || !dataToRender) return null;

  return (
    <Modal
      key={previewEmployee?.id} // ✅ prevents stale employee flash
      open={previewModal.isOpen}
      onClose={previewModal.onClose}
    >
      <div className="grid w-full grid-cols-1 items-start gap-x-6 gap-y-8 sm:grid-cols-2 md:grid-cols-3 lg:gap-x-8">
        <div className="col-span-1">
          <Gallery
            images={dataToRender.images ?? []}
            employeeId={dataToRender.id}
            employeeNo={dataToRender.employeeNo ?? ""}
            gender={dataToRender.gender as "Male" | "Female" | undefined}
          />
        </div>

        <div className="sm:col-span-1 md:col-span-2 lg:col-span-2">
          <Info data={dataToRender as Employees} />

          {loading && (
            <p className="mt-2 text-xs text-muted-foreground">
              Loading full employee details…
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default PreviewModal;
