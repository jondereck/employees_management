"use client"

import { Menu } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { MainNav } from "./main-nav";
import { MobileSidebar2 } from "./sidebar";
import { useState } from "react";


const MobileNavbar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);


  const handleSidebarToggle = () => {
    setIsSidebarOpen(!isSidebarOpen)

    if (isSidebarOpen) {
      setIsSidebarOpen(isSidebarOpen);
    };

  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false); // Close the sidebar
  };


  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={handleSidebarToggle}
        >
          <Menu />
        </Button>
      </SheetTrigger>
      {
        isSidebarOpen && (
          <SheetContent side="left" className="p-0">
          <MobileSidebar2 
            onClose={handleSidebarClose}
          />
        </SheetContent>
        )
      }
     
    </Sheet>
  );
}

export default MobileNavbar;