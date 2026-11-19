import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <ol
      className={cn(
        "grid gap-4",
        steps.length > 4 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-4",
        className,
      )}
      aria-label="Progres pendaftaran"
    >
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isComplete = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <li
            key={step}
            className={cn(
              "flex flex-col items-center gap-2 text-center text-xs",
              isCurrent || isComplete ? "font-semibold text-dark" : "text-muted",
            )}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs font-semibold",
                isCurrent || isComplete
                  ? "bg-green text-white"
                  : "bg-bg text-muted",
              )}
            >
              {isComplete ? <Check aria-hidden="true" size={16} /> : stepNumber}
            </span>
            {step}
          </li>
        );
      })}
    </ol>
  );
}
