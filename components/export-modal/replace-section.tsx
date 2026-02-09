"use client";

import React, { useState } from "react";
import { Search, MoveRight, Plus, Trash2, Info, Regex } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const ReplaceSection = ({ state, actions }: any) => {
  const [newRule, setNewRule] = useState({ targets: [], replaceWith: '', mode: 'startsWith' });

  return (
    <div className="space-y-8 py-4">
      {/* Rule Creator */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6">
        <h4 className="text-sm font-bold text-indigo-900 mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Create New Replacement Rule
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5 space-y-2">
            <label className="text-xs font-semibold text-slate-500 ml-1">Original Position(s)</label>
            <Input placeholder="e.g. Teacher I, Teacher II" className="bg-white" />
          </div>
          
          <div className="md:col-span-1 flex justify-center pb-2">
            <MoveRight className="text-slate-300" />
          </div>

          <div className="md:col-span-4 space-y-2">
            <label className="text-xs font-semibold text-slate-500 ml-1">Export As</label>
            <Input placeholder="e.g. TEACHER" className="bg-white" />
          </div>

          <div className="md:col-span-2">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-md">
              Add Rule
            </Button>
          </div>
        </div>
      </div>

      {/* Active Rules List */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-slate-900 flex items-center justify-between">
          Active Position Rules
          <Badge variant="secondary">{state.positionReplaceRules.length} Active</Badge>
        </h4>

        <div className="grid grid-cols-1 gap-3">
          {state.positionReplaceRules.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-2xl text-slate-400">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm italic">No replacement rules defined. Positions will export as-is.</p>
            </div>
          ) : (
            state.positionReplaceRules.map((rule: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl group hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {rule.targets.map((t: string) => (
                      <Badge key={t} variant="outline" className="bg-slate-50 font-medium">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <MoveRight className="h-4 w-4 text-slate-300" />
                  <span className="font-bold text-indigo-600">{rule.replaceWith}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => actions.removePositionRule(idx)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};