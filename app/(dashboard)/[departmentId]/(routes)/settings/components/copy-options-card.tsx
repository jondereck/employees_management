"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"
import { Copy, RotateCcw } from "lucide-react";

import {
  DEFAULT_COPY_OPTIONS,
  loadCopyOptions,
  saveCopyOptions,
  buildPreview,
  type CopyOptions,
  type Field,
  type Format,
} from "@/utils/copy-utils";
import { FormatToggleGroup } from "../../(frontend)/view/components/ui/format-toggle-group";


// Optional sample for the preview only
const SAMPLE = {
  fullName: "Juan Dela Cruz",
  position: "Position (Detailed Title III)",
  office: "Commission On Election (Comelec)",
};


export default function CopyOptionsCard() {
  const [options, setOptions] = useState<CopyOptions>(DEFAULT_COPY_OPTIONS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOptions(loadCopyOptions());
    setHydrated(true);
  }, []);

  const preview = useMemo(() => buildPreview(SAMPLE, options), [options]);

  const toggleField = (field: Field) => {
    setOptions((prev) => {
      const exists = prev.fields.includes(field);
      const nextFields = exists ? prev.fields.filter((f) => f !== field) : [...prev.fields, field];
      return { ...prev, fields: nextFields };
    });
  };

  const onChangeFormat = (fmt: Format) => setOptions((prev) => ({ ...prev, format: fmt }));

  const handleSave = () => {
    saveCopyOptions(options);
    toast.success("Copy options saved.");
  };

  const handleReset = () => {
    setOptions(DEFAULT_COPY_OPTIONS);
    saveCopyOptions(DEFAULT_COPY_OPTIONS);
    toast.success("Copy options reset.");
  };

  const handleCopyTest = async () => {
    await navigator.clipboard.writeText(preview);
    toast.success("Preview copied!");
  };

  if (!hydrated) return null;

  return (
 <Card id="copy-options" className="mx-auto w-full border-slate-100 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/80 backdrop-blur-md">


  <CardContent className="p-6 space-y-8">
    {/* Active Selection Tags */}
    <div className="space-y-3">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Pipeline</h4>
      <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
        {options.fields.length ? (
          options.fields.map((f) => (
            <Badge key={f} className="rounded-lg bg-indigo-50 text-indigo-700 border-indigo-100 px-3 py-1 font-bold capitalize animate-in zoom-in duration-300">
              {f === 'fullName' ? 'Full Name' : f}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-slate-400 italic">No fields selected...</span>
        )}
      </div>
    </div>

    {/* Field Selection Tiles */}
    <div className="space-y-4">
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Include in Clipboard</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(["fullName", "position", "office"] as Field[]).map((field) => {
          const isActive = options.fields.includes(field);
          return (
            <label 
              key={field} 
              className={`flex items-center justify-between p-3 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                isActive 
                ? "border-indigo-600 bg-indigo-50/50 shadow-sm" 
                : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <span className={`text-sm font-bold capitalize ${isActive ? "text-indigo-900" : "text-slate-600"}`}>
                {field === 'fullName' ? 'Full Name' : field}
              </span>
              <Checkbox
                className="rounded-full border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                checked={isActive}
                onCheckedChange={(checked) => {
                  if (checked !== "indeterminate") toggleField(field);
                }}
              />
            </label>
          );
        })}
      </div>
    </div>

    {/* Formatting Controls */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Transformation</h4>
        <div className="flex items-center gap-2">
          <div className="flex-1 p-1 bg-slate-100 rounded-2xl flex">
             <FormatToggleGroup 
                value={options.format} 
                onChange={onChangeFormat} 
                className="w-full bg-transparent"
             />
          </div>
          <Button 
            type="button" 
            variant="outline" 
            size="icon" 
            onClick={handleReset} 
            className="rounded-xl border-slate-200 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
          <span className="text-indigo-600 font-bold">Smart Capitalize:</span> Auto-corrects minor words (of/the) and keeps acronyms like (COMELEC) in uppercase.
        </p>
      </div>

      {/* Live Preview Console */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Live Preview</h4>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            onClick={handleCopyTest}
            className="h-7 text-[10px] font-black uppercase tracking-tighter hover:bg-slate-900 hover:text-white rounded-lg"
          >
            <Copy className="mr-1.5 h-3 w-3" />
            Test Copy
          </Button>
        </div>
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-500"></div>
          <div className="relative rounded-xl border border-slate-900 bg-slate-900 p-4 font-mono text-xs leading-relaxed text-indigo-300 shadow-2xl min-h-[60px] flex items-center">
            {preview || <span className="text-slate-600 italic">Select fields to generate preview...</span>}
          </div>
        </div>
      </div>
    </div>
  </CardContent>

  <CardFooter className="flex items-center justify-end gap-3 p-6 bg-slate-50/50 border-t border-slate-100">
    <Button 
      variant="ghost" 
      onClick={handleReset}
      className="font-bold text-slate-500 hover:text-rose-600"
    >
      Reset
    </Button>
    <Button 
      onClick={handleSave} 
      disabled={options.fields.length === 0}
      className="bg-slate-900 text-white hover:bg-indigo-600 px-8 rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-30 shadow-lg shadow-slate-200"
    >
      Save Configuration
    </Button>
  </CardFooter>
</Card>
  );
}
