import { HTMLAttributes, forwardRef } from "react";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive";
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const variantStyles = {
      default: "bg-secondary border-border text-foreground",
      destructive: "bg-destructive/10 border-destructive text-destructive",
    };

    return (
      <div
        ref={ref}
        className={`border rounded-lg p-4 ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Alert.displayName = "Alert";

export const AlertDescription = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className = "", children, ...props }, ref) => {
  return (
    <div ref={ref} className={`text-sm ${className}`} {...props}>
      {children}
    </div>
  );
});

AlertDescription.displayName = "AlertDescription";
