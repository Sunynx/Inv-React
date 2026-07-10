import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface MultiSelectPopoverProps {
  options: { label: string; value: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
  title: string
}

export function MultiSelectPopover({ options, selected, onChange, title }: MultiSelectPopoverProps) {
  const [open, setOpen] = React.useState(false)

  const safeSelected = Array.isArray(selected) ? selected : (selected ? [String(selected)] : [])
  const handleSelect = (value: string) => {
    const isSelected = safeSelected.includes(value)
    if (isSelected) {
      onChange(safeSelected.filter((item) => item !== value))
    } else {
      onChange([...safeSelected, value])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex h-10 px-4 w-full sm:w-[160px] items-center justify-between rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 shadow-sm text-sm font-medium hover:bg-slate-50 transition-all outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:pointer-events-none disabled:opacity-50"
        aria-expanded={open}
      >
        <span className="truncate">
          {safeSelected.length === 0 ? title : `${title} (${safeSelected.length})`}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 rounded-xl" align="start">
        <Command>
          <CommandInput placeholder={`Search ${title}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      safeSelected.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
