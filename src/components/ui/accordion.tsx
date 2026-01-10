"use client";

import { createContext, useContext, useState, forwardRef, HTMLAttributes } from "react";

interface AccordionContextType {
  openItem: string | null;
  onItemToggle: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);

interface AccordionProps extends HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple";
  collapsible?: boolean;
  defaultValue?: string;
}

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  ({ className = "", type = "single", collapsible = false, defaultValue, children, ...props }, ref) => {
    const [openItem, setOpenItem] = useState<string | null>(defaultValue || null);

    const handleItemToggle = (value: string) => {
      if (type === "single") {
        setOpenItem(openItem === value && collapsible ? null : value);
      }
    };

    return (
      <AccordionContext.Provider value={{ openItem, onItemToggle: handleItemToggle }}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);

Accordion.displayName = "Accordion";

interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

const AccordionItemContext = createContext<string>("");

export const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className = "", value, children, ...props }, ref) => {
    return (
      <AccordionItemContext.Provider value={value}>
        <div ref={ref} className={`border-b ${className}`} {...props}>
          {children}
        </div>
      </AccordionItemContext.Provider>
    );
  }
);

AccordionItem.displayName = "AccordionItem";

interface AccordionTriggerProps extends HTMLAttributes<HTMLButtonElement> {}

export const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className = "", children, ...props }, ref) => {
    const context = useContext(AccordionContext);
    const itemValue = useContext(AccordionItemContext);

    if (!context) throw new Error("AccordionTrigger must be used within Accordion");

    const isOpen = context.openItem === itemValue;

    const handleClick = () => {
      context.onItemToggle(itemValue);
    };

    return (
      <button
        ref={ref}
        type="button"
        className={`flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline w-full text-left ${className}`}
        onClick={handleClick}
        {...props}
      >
        {children}
        <svg
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }
);

AccordionTrigger.displayName = "AccordionTrigger";

interface AccordionContentProps extends HTMLAttributes<HTMLDivElement> {}

export const AccordionContent = forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className = "", children, ...props }, ref) => {
    const context = useContext(AccordionContext);
    const itemValue = useContext(AccordionItemContext);

    if (!context) throw new Error("AccordionContent must be used within Accordion");

    const isOpen = context.openItem === itemValue;

    return (
      <div
        ref={ref}
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        {...props}
      >
        <div className={`pb-4 pt-0 ${className}`}>{children}</div>
      </div>
    );
  }
);

AccordionContent.displayName = "AccordionContent";
