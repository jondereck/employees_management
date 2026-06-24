"use client";

import { useState, useMemo } from "react";

import StepPeriod, { type PeriodStepState } from "./StepPeriod";
import StepUpload, { type UploadStepState } from "./StepUpload";
import StepPreview from "./StepPreview";

const STEPS = ["Period", "Upload", "Preview"] as const;

export type AutoDTRWizardState = {
  period: PeriodStepState;
  upload: UploadStepState;
};

const createInitialState = (): AutoDTRWizardState => ({
  period: {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    manualExclusions: [],
    holidays: [],
  },
  upload: {
    files: [],
    selectedEmployeeIds: [],
    selectedOfficeIds: [],
    splitTime: "12:00",
    rounding: "none",
    preview: null,
    isGenerating: false,
  },
});

export default function AutoDTRWizard() {
  const [state, setState] = useState<AutoDTRWizardState>(createInitialState);
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = STEPS[stepIndex];

  const canProceed = useMemo(() => {
    if (currentStep === "Period") {
      return Boolean(state.period.month && state.period.year);
    }
    if (currentStep === "Upload") {
      return state.upload.preview != null;
    }
    return true;
  }, [currentStep, state.period.month, state.period.year, state.upload.preview]);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
        {STEPS.map((label, index) => {
          const active = index === stepIndex;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setStepIndex(index)}
              className={`rounded-full px-4 py-2 transition ${
                active ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {index + 1}. {label}
            </button>
          );
        })}
      </nav>

      {currentStep === "Period" ? (
        <StepPeriod
          value={state.period}
          onChange={(next) =>
            setState((prev) => ({ ...prev, period: { ...prev.period, ...next } }))
          }
          onNext={() => setStepIndex(1)}
        />
      ) : null}

      {currentStep === "Upload" ? (
        <StepUpload
          value={state.upload}
          period={state.period}
          onChange={(next) =>
            setState((prev) => ({ ...prev, upload: { ...prev.upload, ...next } }))
          }
          onBack={() => setStepIndex(0)}
          onNext={() => setStepIndex(2)}
        />
      ) : null}

      {currentStep === "Preview" && state.upload.preview ? (
        <StepPreview
          value={state.upload.preview}
          onBack={() => setStepIndex(1)}
          onReset={() => {
            setState(createInitialState());
            setStepIndex(0);
          }}
        />
      ) : null}

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
        >
          Back
        </button>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={!canProceed}
          onClick={() => {
            if (stepIndex < STEPS.length - 1 && canProceed) {
              setStepIndex((prev) => prev + 1);
            }
          }}
        >
          {stepIndex === STEPS.length - 1 ? "Done" : "Continue"}
        </button>
      </div>
    </div>
  );
}
