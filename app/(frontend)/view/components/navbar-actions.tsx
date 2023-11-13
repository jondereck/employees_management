"use client"
import { PersonStanding } from "lucide-react";
import Button2 from "./ui/button";

const NavbarActions = () => {
  return ( 
    <div className="ml-auto flex items-center gap-x-4">
      <Button2 className="flex item-center rounded-full bg-black px-4 py-2">
        <PersonStanding
          size={20}
          color="white"
        />
      </Button2>
    </div>
   );
}
 
export default NavbarActions;
