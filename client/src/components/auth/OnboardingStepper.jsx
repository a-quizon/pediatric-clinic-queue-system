import React from "react";
import { Check } from "lucide-react";

export default function OnboardingStepper({
  currentStep = 1,
  steps = [
    { id: 1, label: "Verify Email" },
    { id: 2, label: "Add Child" },
  ],
}) {

  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      {steps.map((step, index) => {
        const isComplete = currentStep > step.id;
        const isCurrent = currentStep === step.id;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border ${
                  isComplete
                    ? "text-white"
                    : isCurrent
                      ? ""
                      : "pq-faint"
                }`}
                style={
                  isComplete
                    ? { background: "var(--pq-mark-blue)", borderColor: "var(--pq-mark-blue)" }
                    : isCurrent
                      ? {
                          background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)",
                          borderColor: "var(--pq-mark-blue)",
                          color: "var(--pq-mark-blue-deep)",
                        }
                      : {
                          background: "color-mix(in srgb, #ffffff 55%, transparent)",
                          borderColor: "var(--pq-glass-line)",
                        }
                }
              >
                {isComplete ? <Check className="w-4 h-4" /> : step.id}
              </div>
              <span className={`text-xs font-semibold ${isCurrent || isComplete ? "" : "pq-faint"}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className="w-10 h-0.5 mb-5"
                style={{ background: currentStep > 1 ? "var(--pq-mark-blue)" : "var(--pq-glass-line)" }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
