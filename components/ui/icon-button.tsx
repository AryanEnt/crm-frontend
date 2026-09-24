import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export interface IconButtonProps extends Omit<ButtonProps, "size" | "children"> {
  label: string;
  size?: "default" | "sm";
  children: React.ReactNode;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, size = "default", className, children, ...props }, ref) => (
    <Button
      ref={ref}
      size={size === "sm" ? "icon-sm" : "icon"}
      variant={props.variant ?? "ghost"}
      className={cn("text-foreground-muted", className)}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </Button>
  ),
);
IconButton.displayName = "IconButton";
