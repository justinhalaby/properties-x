import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  const baseClasses =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors";

  const variantClasses = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    outline: "border border-border text-foreground",
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
