import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Two button grammars (docs/design-system.md rule 7): pill for actions, 8px rects for compact utility.
 * Every button presses with scale(0.95) (rule 9). No shadows.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-normal transition-[transform,background-color,color,border-color] duration-150 active:scale-[0.95] disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "rounded-full bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "rounded-full border border-primary bg-transparent text-primary hover:bg-primary/[0.06]",
        secondary: "rounded-md border-[3px] border-divider bg-secondary text-secondary-foreground hover:bg-card",
        destructive: "rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90",
        dark: "rounded-sm bg-foreground text-background hover:bg-foreground/90",
        ghost: "rounded-sm text-foreground hover:bg-muted",
        link: "rounded-sm px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-[22px] text-body",
        sm: "h-8 px-3.5 text-caption",
        lg: "h-12 px-7 text-button-large",
        icon: "h-9 w-9 rounded-sm",
      },
    },
    compoundVariants: [
      { variant: "ghost", size: "sm", className: "px-2.5" },
    ],
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
Button.displayName = "Button"

export { Button, buttonVariants }
