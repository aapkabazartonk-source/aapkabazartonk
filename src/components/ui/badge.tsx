import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-success-soft text-foreground",
        secondary: "border-transparent bg-purple-soft text-purple",
        purple: "border-transparent bg-purple-soft text-purple",
        accent: "border-transparent bg-accent/30 text-foreground",
        outline: "border-border bg-card text-foreground",
        warning: "border-transparent bg-warning-soft text-warning",
        destructive: "border-transparent bg-danger-soft text-destructive",
        success: "border-transparent bg-success-soft text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
