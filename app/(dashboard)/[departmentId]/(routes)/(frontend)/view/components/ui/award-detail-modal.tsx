"use client";

import Image from "next/image";
import { Award, Calendar, Building2, FileText, ExternalLink, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Employees } from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/types";
import { formatDate } from "@/utils/utils";

interface Props {
  award: NonNullable<Employees["awards"]>[number] | null;
  onClose: () => void;
}

const AwardDetailModal = ({ award, onClose }: Props) => {
  if (!award) return null;

  return (
    <Dialog open={!!award} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay className="z-[70] bg-slate-900/40 backdrop-blur-sm" />
        <DialogContent className="fixed z-[9999] max-w-md p-0 overflow-hidden border-none shadow-2xl">
          {/* TOP ACCENT BAR */}
          <div className="h-1.5 w-full bg-amber-500" />
          
          <div className="p-8">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-amber-50">
                  <Award className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em]">
                  Achievement Detail
                </span>
              </div>
              <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">
                {award.title}
              </DialogTitle>
            </DialogHeader>

            {award.thumbnail && (
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-100 mb-6 shadow-sm group">
                <Image
                  src={award.thumbnail}
                  alt={award.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            )}

            <div className="space-y-6">
              {/* META INFO GRID */}
              <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Calendar className="h-3 w-3" />
                    Date Given
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    {formatDate(String(award.givenAt))}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Building2 className="h-3 w-3" />
                    Issuer
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    {award.issuer || "Internal"}
                  </p>
                </div>
              </div>

              {/* DESCRIPTION */}
              {award.description && (
                <div className="space-y-2">
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Citation / Description
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg italic">
                    {award.description}
                  </p>
                </div>
              )}

              {/* TAGS */}
              {award.tags && award.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {award.tags.map((tag) => (
                    <span 
                      key={tag} 
                      className="px-2.5 py-1 rounded-md bg-indigo-50 text-[10px] font-bold text-indigo-600 uppercase tracking-tight border border-indigo-100"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* ATTACHMENT BUTTON */}
              {award.fileUrl && (
                <a
                  href={award.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-bold transition-all hover:bg-slate-800 hover:shadow-lg active:scale-[0.98]"
                >
                  <FileText className="h-4 w-4" />
                  View Original Certificate
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </a>
              )}
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

export default AwardDetailModal;