"use client";

import { forwardRef, LabelHTMLAttributes } from "react";

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = "", ...props }, ref) => {
    const baseStyles =
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70";

    return (
      <label
        ref={ref}
        className={`${baseStyles} ${className}`}
        {...props}
      />
    );
  }
);

Label.displayName = "Label";
