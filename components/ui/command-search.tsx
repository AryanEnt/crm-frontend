"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users, Handshake, CalendarPlus } from "lucide-react";
import { Modal, ModalContent } from "@/components/ui/modal";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { mainNav } from "@/lib/navigation";

export type CommandSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuickCreate?: (entity: "lead" | "customer" | "deal" | "activity") => void;
};

export function CommandSearch({ open, onOpenChange, onQuickCreate }: CommandSearchProps) {
  const router = useRouter();
  const items = mainNav.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      group: section.title ?? "Workspace",
    })),
  );

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const createActions = [
    { id: "lead" as const, label: "Create Lead", icon: UserPlus },
    { id: "customer" as const, label: "Create Customer", icon: Users },
    { id: "deal" as const, label: "Create Deal", icon: Handshake },
    { id: "activity" as const, label: "Create Activity", icon: CalendarPlus },
  ];

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg overflow-hidden p-0" showClose={false}>
        <Command>
          <CommandInput placeholder="Search pages, or create a record…" />
          <CommandList>
            <CommandEmpty>No matches found.</CommandEmpty>
            {onQuickCreate ? (
              <CommandGroup heading="Quick create">
                {createActions.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`create ${a.label}`}
                    onSelect={() => {
                      onOpenChange(false);
                      onQuickCreate(a.id);
                    }}
                  >
                    <a.icon className="size-3.5 text-brand" />
                    {a.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {["Workspace", "Administration"].map((group) => (
              <CommandGroup key={group} heading={group}>
                {items
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <CommandItem
                      key={item.href}
                      value={`${item.label} ${item.href}`}
                      onSelect={() => {
                        onOpenChange(false);
                        router.push(item.href);
                      }}
                    >
                      <item.icon className="size-3.5 text-foreground-muted" />
                      {item.label}
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </ModalContent>
    </Modal>
  );
}
