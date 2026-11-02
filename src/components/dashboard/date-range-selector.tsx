"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateRangeSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
}

export function DateRangeSelector({
  value = "30d",
  onValueChange,
}: DateRangeSelectorProps) {
  return (
    <Select defaultValue={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Select range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7d">Last 7 days</SelectItem>
        <SelectItem value="30d">Last 30 days</SelectItem>
        <SelectItem value="90d">Last 90 days</SelectItem>
        <SelectItem value="ytd">Year to date</SelectItem>
        <SelectItem value="12m">Last 12 months</SelectItem>
      </SelectContent>
    </Select>
  );
}
