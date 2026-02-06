"use client";

import { useState } from "react";
import { 
  Trophy, 
  Award as AwardIcon, 
  Image as ImageIcon, 
  Calendar, 
  Building2,
  ExternalLink 
} from "lucide-react";
import AwardDetailModal from "./award-detail-modal";
import { Employees } from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/types";
import { formatDate } from "@/utils/utils";
import { cn } from "@/lib/utils";

type AwardItem = NonNullable<Employees["awards"]>[number];

interface Props {
  awards?: Employees["awards"];
}

const AwardPreview = ({ awards }: Props) => {
  const [selected, setSelected] = useState<AwardItem | null>(null);

  if (!awards || awards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
        <Trophy className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-500">No awards or recognition recorded</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* HEADER */}
      <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Awards & Recognition
          </h2>
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Showing {Math.min(awards.length, 3)} of {awards.length}
        </span>
      </div>

      {/* CONTENT */}
      <div className="divide-y divide-slate-100">
        {awards.slice(0, 3).map((award) => {
          const hasMedia = !!award.thumbnail || !!award.fileUrl;

          return (
            <button
              key={award.id}
              type="button"
              onClick={() => setSelected(award)}
              className="group w-full p-6 text-left transition-colors hover:bg-slate-50/80 flex flex-col md:flex-row md:items-start gap-4"
            >
              {/* DATE ICON BOX */}
              <div className="hidden md:flex flex-col items-center justify-center h-14 w-14 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0">
                <span className="text-[10px] uppercase font-bold leading-none mb-1">
                  {new Date(award.givenAt).toLocaleString('default', { month: 'short' })}
                </span>
                <span className="text-lg font-black leading-none">
                  {new Date(award.givenAt).getDate()}
                </span>
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {award.title}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Building2 className="h-3.5 w-3.5" />
                        {award.issuer || "Internal Recognition"}
                      </div>
                      <div className="md:hidden flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Calendar className="h-3.5 w-3.5" />
                       {formatDate(String(award.givenAt))}
                      </div>
                    </div>
                  </div>

                  {hasMedia && (
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                  )}
                </div>

                {award.description && (
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed italic">
                    {award.description}
                  </p>
                )}

                {/* TAGS (if they exist in your schema) */}
                {award.tags && award.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {award.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="self-center md:opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="h-4 w-4 text-slate-400" />
              </div>
            </button>
          );
        })}
      </div>
      
      {awards.length > 3 && (
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-center">
            <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest">
                View All Achievements
            </button>
        </div>
      )}

      <AwardDetailModal
        award={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
};

export default AwardPreview;