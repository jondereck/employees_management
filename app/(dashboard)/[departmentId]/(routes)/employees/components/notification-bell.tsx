import { useEffect, useState } from "react";
import { Bell } from "lucide-react"; // or your Bell icon

const NotificationBell = ({ hasBirthdaysToday }: { hasBirthdaysToday: boolean }) => {
  const [showDot, setShowDot] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]; // e.g. '2025-05-14'
    const dismissedDate = localStorage.getItem("birthdayDismissedDate");

    // Show dot if there are birthdays and the user hasn't dismissed today
    if (hasBirthdaysToday && dismissedDate !== today) {
      setShowDot(true);
    }
  }, [hasBirthdaysToday]);

  const handleClick = () => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("birthdayDismissedDate", today); // mark as dismissed
    setShowDot(false); // hide red dot
  };

  return (
    <div className="relative cursor-pointer" onClick={handleClick}>
      <Bell className="w-6 h-6 text-gray-700" />
      {showDot && (
        <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
      )}
    </div>
  );
};

export default NotificationBell;
