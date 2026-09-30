import { cn } from "@/lib/utils"

export function Progress({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "success" | "warning" | "destructive" }) {
  const v = Math.max(0, Math.min(100, value))
  const color = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", destructive: "bg-destructive" }[tone]
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-divider", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${v}%` }} />
    </div>
  )
}
