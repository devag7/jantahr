import * as React from "react"
import { cn } from "@/lib/utils"

/** Browser-native select: best for long forms (mobile pickers, autofill, no portal quirks). */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full appearance-none rounded-md border border-input bg-card bg-[length:12px] bg-[right_14px_center] bg-no-repeat pl-3.5 pr-9 text-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
      "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%236e6e73' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")]",
      className
    )}
    {...props}
  >
    {children}
  </select>
))
NativeSelect.displayName = "NativeSelect"

export { NativeSelect }
