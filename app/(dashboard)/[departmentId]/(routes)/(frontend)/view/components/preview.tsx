"use client";

import { useEffect, useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

import usePreviewModal from "../hooks/use-preview-modal";
import Info from "./ui/info";
import Modal from "./ui/modal";
import getEmployee from "../actions/get-employee";
import { Employees } from "../types";
import { EmployeesColumn } from "../../../employees/components/columns";
import WorkSchedulePreview from "./ui/work-schedule-preview";
import AwardPreview from "./ui/award-preview";
import EmploymentEventPreview from "./ui/employment-event-preview";
import EmployeeHeader from "./ui/employee-header";

const PreviewModal = () => {
  const previewModal = usePreviewModal();

  const previewEmployee = usePreviewModal(
    (state) => state.previewData
  ) as EmployeesColumn | undefined;

  const [employee, setEmployee] = useState<Employees | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEmployee(null);
  }, [previewEmployee?.id]);

  useEffect(() => {
    if (!previewModal.isOpen || !previewEmployee?.id) return;

    setLoading(true);
    getEmployee(previewEmployee.id)
      .then(setEmployee)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [previewModal.isOpen, previewEmployee?.id]);

  const dataToRender = employee ?? previewEmployee;

  if (!previewModal.isOpen || !dataToRender) return null;

  return (
    <Modal
      key={previewEmployee?.id}
      open={previewModal.isOpen}
      onClose={previewModal.onClose}
    >
      {/* 🟢 MAIN CONTAINER: Simplified to vertical flow */}
      <div className="mx-auto w-full max-w-5xl space-y-8 p-2">
        
        {/* 1. HEADER SECTION (Full Width) */}
        <EmployeeHeader employee={dataToRender as Employees} />

        {/* 2. CONTENT SECTION (Tabs) */}
        <div className="w-full">
          <Tabs defaultValue="info" className="w-full">
            <div className="flex items-center justify-between border-b pb-2 mb-6">
               <TabsList className="bg-transparent h-auto p-0 gap-6">
                <TabsTrigger 
                  value="info" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 font-bold"
                >
                  Info
                </TabsTrigger>
                <TabsTrigger 
                  value="schedule" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 font-bold"
                >
                  Schedule
                </TabsTrigger>
                <TabsTrigger 
                  value="awards" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 font-bold"
                >
                  Awards
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 font-bold"
                >
                  History
                </TabsTrigger>
              </TabsList>
            </div>

            {/* 3. TAB CONTENT AREA */}
            <div className="mt-4">
              <TabsContent value="info" className="outline-none">
                <Info data={dataToRender as Employees} />
                {loading && (
                  <div className="flex items-center gap-2 mt-4 text-xs text-amber-600 animate-pulse font-medium">
                    <span className="h-2 w-2 bg-amber-600 rounded-full"></span>
                    Syncing live employee data...
                  </div>
                )}
              </TabsContent>

              <TabsContent value="schedule" className="outline-none">
                <WorkSchedulePreview
                  schedules={(dataToRender as Employees).workSchedules}
                />
              </TabsContent>

              <TabsContent value="awards" className="outline-none">
                <AwardPreview
                  awards={(dataToRender as Employees).awards}
                />
              </TabsContent>

              <TabsContent value="history" className="outline-none">
                <EmploymentEventPreview
                  events={(dataToRender as Employees).employmentEvents}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </Modal>
  );
};

export default PreviewModal;