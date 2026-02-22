import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        // Custom status variants
        running: "border-zinc-400/30 bg-zinc-400/10 text-zinc-300",
        completed: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
        failed: "border-red-500/30 bg-red-500/10 text-red-400",
        retrying: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
        // Custom type variants
        llm: "border-zinc-300/30 bg-zinc-300/10 text-zinc-300",
        tool: "border-zinc-400/30 bg-zinc-400/10 text-zinc-400",
        plan: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
        final: "border-zinc-300/30 bg-zinc-300/10 text-zinc-300",
        error: "border-red-500/30 bg-red-500/10 text-red-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
