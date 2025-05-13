import React, { useMemo, useState } from "react";
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

interface EmployeesColumn {
  firstName: string;
  lastName: string;
  birthday: string;
  dateHired: string;
  isArchived: boolean;
}

interface NotificationsProps {
  data: EmployeesColumn[];
}

const Notifications = ({ data }: NotificationsProps) => {

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAllAnniversaries, setShowAllAnniversaries] = useState(false);

  const handleViewAllClick = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const today = new Date();
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
      const dob = new Date(emp.birthday);
      const empMonthDay = `${dob.getMonth() + 1}-${dob.getDate()}`;
      return empMonthDay === todayMonthDay && !emp.isArchived;
    });
  }, [data]);

  const hasNotifications = celebrantsToday.length > 0 || retireesThisYear.length > 0 || milestoneAnniversaries.length > 0;


  const upcomingBirthdays = useMemo(() => {
    const today = new Date();

    return data.filter((employee) => {
      if (!employee.birthday || employee.isArchived) return false;

      const birthday = new Date(employee.birthday);
      const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());

      // If birthday has already passed this year, shift to next year
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear() + 1);
      }

      const diffTime = thisYearBirthday.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays > 0 && diffDays <= 7;
    });
  }, [data, today]);

 
 

  // const totalNotifs =
  //   celebrantsToday.length + retireesThisYear.length + anniversariesThisMonth.length;

  return (
    <div className="relative flex items-center">
      <Popover>
        <PopoverTrigger>
           <Bell className="w-6 h-6 text-gray-700" />
  {hasNotifications && (
    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
  )}
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <Tabs defaultValue="birthdays" className="w-full">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="birthdays">Birthdays</TabsTrigger>
              <TabsTrigger value="retirement">Retirements</TabsTrigger>
              <TabsTrigger value="anniversaries">Anniversaries</TabsTrigger>
            </TabsList>

            <TabsContent value="birthdays">
              <div className="p-2 space-y-4">
                {/* Today's Birthdays Header with Icon */}
                <h3 className="text-lg font-semibold text-center flex items-center justify-start gap-2 mb-6">
  <Cake className="h-6 w-6 text-gray-700" />
  Today's Birthdays
</h3>

{celebrantsToday.length > 0 ? (
  <ul className="space-y-2">
    {celebrantsToday.map((emp, index) => (
      <li
        key={index}
        className="flex items-center justify-between p-2 border-b border-gray-200 hover:bg-gray-50 rounded-md"
      >
        <span className="text-sm text-gray-800 font-medium">
          {emp.firstName} {emp.lastName}
        </span>
      </li>
    ))}
  </ul>
) : (
  <p className="text-sm text-gray-500 text-center">No birthdays today</p>
)}


                {/* Upcoming Birthdays Header with Icon */}
                <div className="p-2">
                  {/* Upcoming Birthdays Title */}
                  <h3 className="text-md font-semibold text-center flex items-center justify-start gap-2 mb-6">
                    <Calendar className="h-6 w-6 text-gray-700" />
                    Upcoming Birthdays (7 days)
                  </h3>

                  {/* List of Upcoming Birthdays */}
                  {upcomingBirthdays.length > 0 ? (
                    <ul className="space-y-2">
                      {upcomingBirthdays
                        .sort((a, b) => {
                          const dateA = new Date(a.birthday);
                          const dateB = new Date(b.birthday);
                          const aMonthDay = dateA.getMonth() * 100 + dateA.getDate();
                          const bMonthDay = dateB.getMonth() * 100 + dateB.getDate();
                          return aMonthDay - bMonthDay;
                        })
                        .map((emp, index) => {
                          const date = new Date(emp.birthday);
                          const formatted = date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          });

                          return (
                            <li
                              key={index}
                              className="flex items-center justify-between p-2 border-b border-gray-200 hover:bg-gray-50 rounded-md"
                            >
                              <span className="text-sm text-gray-800 font-medium">
                                {emp.firstName} {emp.lastName}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatted}
                              </span>
                            </li>
                          );
                        })}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 text-center">No upcoming birthdays</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="retirement">
              {retireesThisYear.length > 0 ? (
                <>
                  <ul className="space-y-2">
                    {retireesThisYear.map((emp, index) => {
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
                          <span className="text-sm text-gray-800 font-medium">
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

            <TabsContent value="anniversaries">
              {milestoneAnniversaries.length > 0 ? (
                <>
                  <ul className="space-y-2">
                    {(showAllAnniversaries ? milestoneAnniversaries : milestoneAnniversaries.slice(0, 5))
                      .sort((a, b) => {
                        const aYears = currentYear - new Date(a.dateHired).getFullYear();
                        const bYears = currentYear - new Date(b.dateHired).getFullYear();
                        return bYears - aYears; // Most years of service first
                      })
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
                            <span className="text-sm text-gray-800 font-medium">
                              {emp.firstName} {emp.lastName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {years} years on {formatted}
                            </span>
                          </li>
                        );
                      })}
                  </ul>

              
                </>
              ) : (
                <p className="text-sm text-gray-500 text-center">No milestone anniversaries</p>
              )}
            </TabsContent>

            <div>
      {/* Retirees Tab */}
      <TabsContent value="retirement">
        {retireesThisYear.length > 0 ? (
          <>
            <ul className="space-y-2">
              {retireesThisYear.map((emp, index) => {
                const birthDate = new Date(emp.birthday);
                const formatted = birthDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <li
                    key={index}
                    className="flex items-center justify-between p-2 border-b border-gray-200 hover:bg-gray-50 rounded-md"
                  >
                    <span className="text-sm text-gray-800 font-medium">
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
        {milestoneAnniversaries.length > 0 ? (
          <>
            <ul className="space-y-2">
              {(showAllAnniversaries
                ? milestoneAnniversaries
                : milestoneAnniversaries.slice(0, 5)
              )
              .sort((a, b) => {
                const aYears = currentYear - new Date(a.dateHired).getFullYear();
                const bYears = currentYear - new Date(b.dateHired).getFullYear();
                return bYears - aYears; // Most years of service first
              })
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
                      <span className="text-sm text-gray-800 font-medium">
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
                  {showAllAnniversaries ? 'Show Less' : 'View All'}
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
  isOpen={isModalOpen}
  onClose={closeModal}
>
  <div className="space-y-2 max-h-[70vh] overflow-y-auto">
    {milestoneAnniversaries
      .sort((a, b) => {
        const aYears = currentYear - new Date(a.dateHired).getFullYear();
        const bYears = currentYear - new Date(b.dateHired).getFullYear();
        return bYears - aYears; // Most years of service first
      })
      .map((emp, index) => {
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
            <span className="text-sm text-gray-800 font-medium">
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
      
     

    </div>

    
  );
};

export default Notifications;
