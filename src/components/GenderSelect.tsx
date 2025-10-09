"use client";

import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface GenderOption {
  value: string;
  label: string;
}

interface GenderSelectProps {
  initialGender: string | null;
  onGenderChange: (gender: string) => void;
  options: GenderOption[];
  disabled?: boolean;
}

export const GenderSelect = ({ initialGender, onGenderChange, options, disabled }: GenderSelectProps) => {
  const [selectedGender, setSelectedGender] = React.useState<string>(initialGender ?? options[0].value);

  React.useEffect(() => {
    setSelectedGender(initialGender ?? options[0].value);
  }, [initialGender, options]);

  const handleValueChange = (value: string) => {
    setSelectedGender(value);
    onGenderChange(value);
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium text-primary/90 block text-center">Gênero:</Label>
      <RadioGroup
        value={selectedGender}
        onValueChange={handleValueChange}
        className="flex justify-center gap-4"
        disabled={disabled}
      >
        {options.map((option) => (
          <div key={option.value} className="flex flex-col items-center space-y-2">
            <RadioGroupItem value={option.value} id={`gender-${option.value}`} className="peer sr-only" />
            <Label
              htmlFor={`gender-${option.value}`}
              className={cn(
                "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="text-sm font-medium">{option.label}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};