"use client";


import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Separator } from "@/components/ui/separator";
import { Facebook, Instagram, Linkedin, LinkedinIcon } from "lucide-react";
import Link from "next/link";


const SettingsFooter = () => {
  return (
    <div className="flex-col justify-between items-center gap-2  ">
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button variant="link">@jonderecknifas</Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="flex justify-between space-x-4">
            <Avatar>
              <AvatarImage src="https://res.cloudinary.com/ddzjzrqrj/image/upload/v1714969016/Screenshot_20240506_121613_Facebook_wpodco.png" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div className="space-y-1  ">
              <h4 className="text-sm font-semibold">@jonderecknifas</h4>
              <div className="flex gap-2 ">
                <Link target="_blank" href="https://www.linkedin.com/in/jdnifas/">
                  <LinkedinIcon size={20} 
                  style={{ color: "#0077b5" }} className="text-blue-500 hover:scale-110 transition"/>
                </Link>
                <Link target="_blank" href="https://www.facebook.com/gwattty?mibextid=ZbWKwL">
                  <Facebook size={20} 
                  style={{ color: "#3b5998" }}className="hover:scale-110 transition" />
                </Link>
                <Link target="_blank" href="https://www.instagram.com/gwattty/">
                  <Instagram size={20} style={{ color: "#c13584" }} className="hover:scale-110 transition"/>
                </Link>
              </div>

              <p className="text-sm">
                Senior Developer - Developed the Employee Management System
              </p>
              <div className="flex items-center pt-2">
                {" "}
                <span className="text-xs text-muted-foreground">
                  Since 2023
                </span>
              </div>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>

      <HoverCard>

        <HoverCardTrigger asChild>
          <Button variant="link">@kristheljadeocde</Button>
        </HoverCardTrigger>

        <HoverCardContent className="w-80">
          <div className="flex justify-between space-x-4">
            <Avatar>
              <AvatarImage src="https://res.cloudinary.com/ddzjzrqrj/image/upload/v1714968174/FB_IMG_1714967966149_pevqao_yes_b6gi6y.jpg" />
              <AvatarFallback>K</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">@kristheljadeocde</h4>
              <div className="flex gap-2" >
                <Link href="https://www.facebook.com/profile.php?id=100089224303019&mibextid=ZbWKwL"
                  target="_blank">
                  <Facebook style={{ color: "#0077b5" }} size={20} 
                  className="hover:scale-110 transition"/>
                </Link>
                <Link target="_blank" href="https://www.instagram.com/kristheljade07/">
                  <Instagram size={20} style={{ color: "#c13584" }}   className="hover:scale-110 transition"
                  />
                </Link>
              </div>
              <p className="text-sm">
                Junior Developer - Assisted on the Employee Management System
              </p>
              <div className="flex items-center pt-2">
                {" "}
                <span className="text-xs text-muted-foreground">
                  Since 2023
                </span>
              </div>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>

      <div className="flex-col justify-between items-center gap-2">
      {/* Your existing hover card components */}
      <footer className="flex justify-center items-center ">
        <p className="text-xs text-gray-600">© 2023 JDN Systems. All rights reserved.</p>
      </footer>
    </div>



    </div>

  );
}

export default SettingsFooter;