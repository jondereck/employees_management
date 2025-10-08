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
    <Card id="copy-options" className="mx-auto w-full  border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Copy Options</CardTitle>
        <CardDescription>
          Configure the fields and formatting used when copying employee info.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Selected summary */}
        <div className="flex flex-wrap items-center gap-2">
          {options.fields.length ? (
            options.fields.map((f) => (
              <Badge key={f} variant="secondary" className="capitalize">
                {f}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No fields selected yet</span>
          )}
        </div>

        <Separator />

        {/* Fields */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Fields to include</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(["fullName", "position", "office"] as Field[]).map((field) => (
              <label key={field} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={options.fields.includes(field)}
                  onCheckedChange={(checked) => {
                    if (checked !== "indeterminate") toggleField(field);
                  }}
                />
                <span className="capitalize">{field}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Formatting */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Formatting</h4>
          <div className="flex items-center gap-3">
            <FormatToggleGroup value={options.format} onChange={onChangeFormat} />
            <Button type="button" variant="ghost" size="icon" onClick={handleReset} title="Reset to default">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            “Capitalize” uses smart title-case (minor words like “on/of/and” are lowercased; acronyms in
            parentheses are uppercased). For <b>office</b>, e.g. <i>Commission On Election (Comelec)</i> becomes{" "}
            <b>Commission on Election (COMELEC)</b>.
          </p>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Preview</h4>
          <div className="rounded-md border bg-muted p-3 text-sm font-mono leading-relaxed">
            {preview || <span className="text-muted-foreground">Nothing selected</span>}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">This preview uses a sample; real copy uses the same rules.</p>
            <Button type="button" variant="outline" size="sm" onClick={handleCopyTest}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copy test
            </Button>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={handleReset}>Reset</Button>
        <Button onClick={handleSave} disabled={options.fields.length === 0}>
          Save Settings
        </Button>
      </CardFooter>
    </Card>
  );
}
