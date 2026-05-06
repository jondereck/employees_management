"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FormatToggleGroup } from "./ui/format-toggle-group";
import {
  DEFAULT_COPY_OPTIONS,
  buildPreview,
  loadCopyOptions,
  saveCopyOptions,
  type Field,
  type Format,
} from "@/utils/copy-utils";

interface CopyOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    fullName: string;
    office: string;
    position: string;
  };
}

const CopyOptionsModal = ({ isOpen, onClose, data }: CopyOptionsModalProps) => {
  const [selectedFields, setSelectedFields] = useState<Field[]>(DEFAULT_COPY_OPTIONS.fields);
  const [format, setFormat] = useState<Format>(DEFAULT_COPY_OPTIONS.format);


  // Load saved copy options once
  useEffect(() => {
    const saved = loadCopyOptions();
    setSelectedFields(saved.fields);
    setFormat(saved.format);
  }, []);


  const handleToggleField = (field: Field) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const previewText = useMemo(() => {
    return buildPreview(data, { fields: selectedFields, format });
  }, [selectedFields, data, format]);

  const handleSaveSettings = () => {
    try {
      saveCopyOptions({ fields: selectedFields, format });
      toast.success("Copy settings saved!");
      onClose();
    } catch {
      toast.error("Failed to save settings.");
    }
  };

  const handleClose = () => {
    // Save current settings to localStorage before resetting state
    saveCopyOptions({ fields: selectedFields, format });


    onClose(); // call parent's close
  };

  return (
    <Modal
      title="Copy Settings"
      description="Select fields and formatting to apply when copying employee info"
      isOpen={isOpen}
      onClose={handleClose}
    >
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-sm mb-2">Fields to include:</h4>
          <div className="flex flex-col space-y-2">
            {(["fullName", "position", "office"] as Field[]).map((field) => (
              <label key={field} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedFields.includes(field)}
                  onCheckedChange={(checked) => {
                    if (checked !== "indeterminate") handleToggleField(field); // updates selectedFields state instantly
                  }}
                />
                <span className="capitalize">{field}</span>
              </label>
            ))}
          </div>
        </div>

        <FormatToggleGroup
          value={format}
          onChange={(newFormat) => setFormat(newFormat)}
        />

        <div className="bg-muted p-3 rounded border text-sm">
          {previewText || <span className="text-muted-foreground">Nothing selected</span>}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={selectedFields.length === 0}>
            Save Settings
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CopyOptionsModal;
