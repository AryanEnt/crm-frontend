"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
          className={cn("h-8 w-full justify-between px-2.5 font-normal shadow-none", !value && "text-foreground-subtle", className)}
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
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
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
              >
                <Check className={cn("size-3.5", !value ? "opacity-100" : "opacity-0")} />
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
                >
                  <Check className={cn("size-3.5", value === o.id ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-xs text-foreground-muted">{o.code}</span>
                  <span className="truncate">{o.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
