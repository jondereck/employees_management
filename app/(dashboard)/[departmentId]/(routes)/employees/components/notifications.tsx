"use client"

import React, { useEffect, useMemo, useState } from "react";
import { Bell, Cake, Calendar } from "lucide-react";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import Modal from "@/components/ui/modal";
import NotificationBell from "./notification-bell";
import { addOneDay, getFormattedDate, getSortedMilestones, getSortedRetirees, isNextYearAnniversary, isRetirementNextYear, sortByMonthDay } from "@/utils/notification-utils";
import Link from "next/link";
import usePreviewModal from "../../(frontend)/view/hooks/use-preview-modal";
import { EmployeesColumn } from "./columns";
import { Button } from "@/components/ui/button";
import { TodaysBirthdays } from "./notification/today-birthdays";
import { UpcomingBirthdays } from "./notification/upcoming-birthday";
import { Retirements } from "./notification/retirements";
import { Anniversaries } from "./notification/anniversaries";


interface NotificationsProps {
  data: EmployeesColumn[];
}

const Notifications = ({ data }: NotificationsProps) => {
  const today = useMemo(() => new Date(), []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnniversaryModalOpen, setIsAnniversaryModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isNotification, setNotification] = useState(true);


  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile)
  }, []);

  const handleViewAllClick = () => {
    setIsAnniversaryModalOpen((prev) => !prev);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };


  const currentYear = today.getFullYear();

  // Retirement notifications - employees turning 65 this year

  const retireesThisYear = data.filter((emp) => {
    if (emp.isArchived) return false;
    const birthDate = new Date(emp.birthday);
    const age = currentYear - birthDate.getFullYear();
    return age === 65;
  });

  // Filter employees with milestone anniversaries (5, 10, 15... years) and not archived
  const milestoneAnniversaries = data.filter((emp) => {
    if (emp.isArchived) return false;
    const hireDate = new Date(emp.dateHired);
    const years = currentYear - hireDate.getFullYear();
    return [10, 15, 20, 25, 30, 35, 40].includes(years);
  });



  const celebrantsToday = useMemo(() => {
    const todayMonthDay = `${today.getMonth() + 1}-${today.getDate()}`;

    return data.filter((emp) => {
      if (!emp.birthday) return false;

      const dob = new Date(emp.birthday);
      if (isNaN(dob.getTime())) return false;

      // ✅ Add 1 day to the birthday before extracting month and day
      dob.setDate(dob.getDate());

      const empMonthDay = `${dob.getMonth() + 1}-${dob.getDate()}`;

      return empMonthDay === todayMonthDay && !emp.isArchived;
    });
  }, [data, today]);


  const upcomingBirthdays = useMemo(() => {
    return data.filter((employee) => {
      if (!employee.birthday || employee.isArchived) return false;

      const birthday = new Date(employee.birthday);
      const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());

      // If birthday has already passed this year, shift to next year
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear());
      }

      const diffTime = thisYearBirthday.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays > 0 && diffDays <= 7;
    });
  }, [data, today]);

  const baseUrl = process.env.NEXT_PUBLIC_URL;



  return (
    <div className="relative flex items-center">
      {isMobile ? (
        <>
          <button onClick={() => setIsModalOpen(true)}>
            <NotificationBell hasBirthdaysToday={celebrantsToday.length > 0} />
          </button>

          <Modal
            title="Notifications"
            description="Birthday, Retirements, Anniversaries"
            isOpen={isModalOpen}
            onClose={closeModal}
          >
            <div className="w-full">
              <Tabs defaultValue="birthdays" className="w-full">
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="birthdays">Birthdays</TabsTrigger>
                  <TabsTrigger value="retirement">Retirements</TabsTrigger>
                  <TabsTrigger value="anniversaries">Anniversaries</TabsTrigger>
                </TabsList>

                <TabsContent value="birthdays">
                  <div className="p-2">
                    {/* Today's Birthdays */}
                    <h3 className="text-lg font-semibold text-center flex items-center justify-start gap-2 mb-6">
                      <Cake className="h-6 w-6 text-yellow-700" />
                      Todays Birthday
                    </h3>
                   <TodaysBirthdays celebrantsToday={celebrantsToday} closeParentModal={closeModal} />
                  </div>
                  {/* Upcoming Birthdays */}
                  <div className="p-2">
                    <h3 className="text-md font-semibold text-center flex items-center justify-start gap-2 mb-6">
                      <Calendar className="h-6 w-6 text-red-700" />
                      Upcoming Birthdays (7 days)
                    </h3>
                    <UpcomingBirthdays
                      celebrantsUpcoming={upcomingBirthdays}
                      onOpenPreview={(emp) => {
                        setNotification(false);
                        usePreviewModal.getState().onOpen(emp);
                      }}
                      closeParentModal={closeModal}
                      limit={8}
                    />
                  </div>
                </TabsContent>
                <div>
                  {/* Retirees Tab */}
                  <TabsContent value="retirement">
                    {retireesThisYear.length > 0 ? (
                      <Retirements retirees={retireesThisYear} />
                    ) : (
                      <p className="text-sm text-gray-500 text-center">No retirees this year</p>
                    )}
                  </TabsContent>

                  <TabsContent value="anniversaries">
                    {milestoneAnniversaries && milestoneAnniversaries.length > 0 ? (
                      <>
                        <Anniversaries milestoneAnniversaries={milestoneAnniversaries} limit={5} />
                        {/* Toggle Button */}
                        {milestoneAnniversaries.length > 5 && (
                          <div className="mt-4 text-center">
                            <Button
                              variant='outline'
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-opacity-50"
                              onClick={handleViewAllClick}
                            >
                              {isAnniversaryModalOpen ? 'Show Less' : 'View All'}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 text-center">No milestone anniversaries</p>
                    )}
                  </TabsContent>
                  {/* Fullscreen Modal for Anniversaries */}
                  <Modal
                    title="All Milestone Anniversaries"
                    description="Here are all employees celebrating milestone years of service."
                    isOpen={isAnniversaryModalOpen}
                    onClose={() => setIsAnniversaryModalOpen(false)}
                  >
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                      {getSortedMilestones(milestoneAnniversaries).map((emp, index) => {
                        const hireDate = new Date(emp.dateHired);
                        const years = currentYear - hireDate.getFullYear();
                        const formatted = hireDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 border-b border-gray-200"
                          >
                            <span
                              className={`text-sm font-medium ${isNextYearAnniversary(emp.dateHired) ? "text-green-600" : "text-gray-800"
                                }`}
                            >
                              {emp.firstName} {emp.lastName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {years} years on {formatted}
                            </span>
                          </div>
                        );
                      })}

                    </div>
                  </Modal>

                </div>
              </Tabs>
            </div>

          </Modal>

        </>
      ) : (
        <Popover>
          <PopoverTrigger>
            <NotificationBell hasBirthdaysToday={celebrantsToday.length > 0} />
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <Tabs defaultValue="birthdays" className="w-full">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="birthdays">Birthdays</TabsTrigger>
                <TabsTrigger value="retirement">Retirements</TabsTrigger>
                <TabsTrigger value="anniversaries">Anniversaries</TabsTrigger>
              </TabsList>
              <TabsContent value="birthdays">
                <div className="p-2">
                  {/* Today's Birthdays */}
                  <h3 className="text-lg font-semibold text-center flex items-center justify-start gap-2 mb-6">
                    <Cake className="h-6 w-6 text-yellow-700" />
                    Todays Birthdays
                  </h3>
                  <TodaysBirthdays celebrantsToday={celebrantsToday} />
                </div>
                {/* Upcoming Birthdays */}
                <div className="p-2">
                  <h3 className="text-md font-semibold text-center flex items-center justify-start gap-2 mb-6">
                    <Calendar className="h-6 w-6 text-red-700" />
                    Upcoming Birthdays (7 days)
                  </h3>

                  <UpcomingBirthdays
                    celebrantsUpcoming={upcomingBirthdays}
                    onOpenPreview={(emp) => {
                      setNotification(false);
                      usePreviewModal.getState().onOpen(emp);
                    }}
                    limit={5}
                  />

                </div>

              </TabsContent>

              <div>

                {/* Retirees Tab */}
                <TabsContent value="retirement">
                  {retireesThisYear.length > 0 ? (
                    <>
                      <ul className="space-y-2">
                        {getSortedRetirees(retireesThisYear).map((emp, index) => {
                          const birthDate = new Date(emp.birthday);
                          const formatted = birthDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          });

                          return (
                            <li
                              key={index}
                              className="flex items-center justify-between p-2 border-b border-gray-200 hover:bg-gray-50 rounded-md"
                            >
                              <span
                                className={`text-sm font-medium ${isRetirementNextYear(emp.birthday) ? "text-green-600" : "text-gray-800"
                                  }`}
                              >
                                {emp.firstName} {emp.lastName}
                              </span>
                              <span className="text-xs text-gray-500">
                                Turns 65 on {formatted}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center">No retirees this year</p>
                  )}
                </TabsContent>

                {/* Anniversaries Tab */}
                <TabsContent value="anniversaries">
                  {milestoneAnniversaries ? (
                    <>
                      <ul className="space-y-2">
                        {(isAnniversaryModalOpen
                          ? getSortedMilestones(milestoneAnniversaries)
                          : getSortedMilestones(milestoneAnniversaries).slice(0, 5)
                        )

                          .map((emp, index) => {
                            const hireDate = new Date(emp.dateHired);
                            const years = currentYear - hireDate.getFullYear();
                            const formatted = hireDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            });
                            return (
                              <li
                                key={index}
                                className="flex items-center justify-between p-2 border-b border-gray-200 hover:bg-gray-50 rounded-md"
                              >
                                <span
                                  className={`text-sm font-medium ${isNextYearAnniversary(emp.dateHired) ? "text-green-600" : "text-gray-800"
                                    }`}
                                >
                                  {emp.firstName} {emp.lastName}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {years} years on {formatted}
                                </span>
                              </li>
                            );
                          })}
                      </ul>

                      {/* Toggle Button */}
                      {milestoneAnniversaries.length > 5 && (
                        <div className="mt-4 text-center">
                          <button
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-opacity-50"
                            onClick={handleViewAllClick}
                          >
                            {isAnniversaryModalOpen ? 'Show Less' : 'View All'}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center">No milestone anniversaries</p>
                  )}
                </TabsContent>

                {/* Fullscreen Modal for Anniversaries */}
                <Modal
                  title="All Milestone Anniversaries"
                  description="Here are all employees celebrating milestone years of service."
                  isOpen={isAnniversaryModalOpen}
                  onClose={() => setIsAnniversaryModalOpen(false)}
                >
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                    {getSortedMilestones(milestoneAnniversaries).map((emp, index) => {
                      const hireDate = new Date(emp.dateHired);
                      const years = currentYear - hireDate.getFullYear();
                      const formatted = hireDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });

                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 border-b border-gray-200"
                        >
                          <span
                            className={`text-sm font-medium ${isNextYearAnniversary(emp.dateHired) ? "text-green-600" : "text-gray-800"
                              }`}
                          >
                            {emp.firstName} {emp.lastName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {years} years on {formatted}
                          </span>
                        </div>
                      );
                    })}

                  </div>
                </Modal>

              </div>
            </Tabs>
          </PopoverContent>

        </Popover>

      )
      }
    </div>
  );
};

export default Notifications;
