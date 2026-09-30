import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/** Status chips: neutral Parchment pill with semantic text colour (rule 2). Never a filled colour block. */
const badgeVariants = cva("inline-flex items-center whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-fine font-semibold", {
  variants: {
    variant: {
      default: "text-primary",
      secondary: "text-secondary-foreground",
      destructive: "text-destructive",
      outline: "border border-border bg-card text-foreground",
      success: "text-success",
      warning: "text-warning",
      info: "text-primary",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
