/**
 * Shared chrome for every popover-based dropdown (Combobox, MultiCombobox,
 * SearchableSelect, AnzscoCombobox) and the Radix Select trigger.
 * Height and padding stay with each component.
 */
export const dropdownTriggerClass = [
  "rounded-md border border-line bg-surface text-sm font-normal shadow-none",
  "hover:border-line hover:bg-surface",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-0",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

/** Menu shell. Pair with `sideOffset={4}` and `align="start"` on PopoverContent. */
export const dropdownMenuClass =
  "w-[var(--radix-popover-trigger-width)] min-w-[16rem] overflow-hidden p-0";
