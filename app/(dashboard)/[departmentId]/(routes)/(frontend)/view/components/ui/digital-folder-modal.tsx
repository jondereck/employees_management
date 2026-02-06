"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderOpen, ChevronRight, ExternalLink, Maximize2 } from "lucide-react";

interface Props {
  link: string;
  employeeName: string;
  themeColor?: string;
}

export const DigitalFolderModal = ({ link, employeeName, themeColor }: Props) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="h-9 px-4 text-xs font-bold uppercase tracking-wide text-white flex items-center gap-2 rounded-lg transition-transform active:scale-95 shadow-lg"
          style={{ backgroundColor: themeColor || "#10b981" }}
        >
          <FolderOpen className="h-4 w-4" />
          View Digital Folder
          <ChevronRight className="h-3 w-3 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-slate-50">
          <div className="space-y-0.5">
            <DialogTitle className="text-sm font-bold uppercase tracking-tight">
              Digital Folder: {employeeName}
            </DialogTitle>
            <p className="text-[10px] text-slate-500 font-medium">Internal System View</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => window.open(link, "_blank")}
            className="h-8 text-[10px] font-bold"
          >
            <ExternalLink className="mr-2 h-3 w-3" />
            Open in New Tab
          </Button>
        </DialogHeader>
        
        {/* THE IFRAME */}
        <div className="flex-1 bg-white relative">
          <iframe
            src={link}
            className="w-full h-full border-none"
            title={`Digital Folder - ${employeeName}`}
            allow="autoplay"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};