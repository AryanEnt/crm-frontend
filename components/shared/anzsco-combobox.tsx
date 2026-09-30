"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { dropdownMenuClass, dropdownTriggerClass } from "@/components/ui/dropdown-styles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { crmApi, type AnzscoOccupation } from "@/lib/api/crm";

export function AnzscoCombobox({
  value,
  onChange,
  className,
}: {
  value?: string | null;
  onChange: (id: string | null, occupation?: AnzscoOccupation | null) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const search = useQuery({
    queryKey: ["anzsco", q],
    queryFn: () => crmApi.searchAnzsco(q),
    enabled: open,
  });

  const selected = search.data?.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            dropdownTriggerClass,
            "h-8 w-full justify-between px-2.5",
            !value && "text-foreground-subtle",
            className,
          )}
        >
          <span className="truncate">
            {selected
              ? `${selected.code} — ${selected.title}`
              : value
                ? "Selected occupation"
                : "Search ANZSCO…"}
          </span>
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={dropdownMenuClass} align="start" sideOffset={4}>
        <Command
          shouldFilter={false}
          defaultValue={selected ? `${selected.code} ${selected.title}` : !value ? "__none" : undefined}
        >
          <CommandInput
            placeholder="Code or title…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>{search.isLoading ? "Searching…" : "No occupations found"}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none"
                onSelect={() => {
                  onChange(null, null);
                  setOpen(false);
                }}
                checked={!value}
              >
                Clear
              </CommandItem>
              {(search.data ?? []).map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.code} ${o.title}`}
                  onSelect={() => {
                    onChange(o.id, o);
                    setOpen(false);
                  }}
                  checked={value === o.id}
                >
                  <span className="font-mono text-xs text-foreground-muted">{o.code}</span>
                  <span className="min-w-0 truncate">{o.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
