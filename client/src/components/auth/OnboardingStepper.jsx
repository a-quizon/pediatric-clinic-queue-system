import React from "react";
import { Check } from "lucide-react";

export default function OnboardingStepper({ currentStep = 1 }) {
  const steps = [
    { id: 1, label: "Verify Email" },
    { id: 2, label: "Add Child" }
  ];

  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      {steps.map((step, index) => {
        const isComplete = currentStep > step.id;
        const isCurrent = currentStep === step.id;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
                  isComplete
                    ? "bg-blue-600 border-blue-600 text-white"
                    : isCurrent
                      ? "bg-blue-50 border-blue-600 text-blue-600"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                {isComplete ? <Check className="w-4 h-4" /> : step.id}
              </div>
              <span className={`text-xs font-semibold ${isCurrent || isComplete ? "text-gray-700" : "text-gray-400"}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-10 h-0.5 mb-5 ${currentStep > 1 ? "bg-blue-600" : "bg-gray-200"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
