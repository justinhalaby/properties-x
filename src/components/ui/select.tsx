import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = "", ...props }: SelectProps) {
  const selectClasses = `
    w-full rounded-lg border border-border bg-background px-3 py-2
    text-sm text-foreground
    focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
    disabled:cursor-not-allowed disabled:opacity-50
    ${className}
  `.trim();

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {label}
        </label>
      )}
      <select className={selectClasses} {...props}>
        {props.children}
      </select>
    </div>
  );
}
