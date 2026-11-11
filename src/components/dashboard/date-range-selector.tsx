"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DashboardPreset } from "@/types/dashboard";

const OPTIONS: Array<{ value: DashboardPreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
];

interface DateRangeSelectorProps {
  value?: DashboardPreset;
  onValueChange?: (value: DashboardPreset) => void;
  disabled?: boolean;
}

export function DateRangeSelector({
  value = "last_7_days",
  onValueChange,
  disabled = false,
}: DateRangeSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange?.(next as DashboardPreset)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[170px]">
        <SelectValue placeholder="Select range" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
