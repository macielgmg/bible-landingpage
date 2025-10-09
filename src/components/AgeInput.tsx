"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface AgeInputProps {
  initialAge: number | null;
  onAgeChange: (age: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
}

export const AgeInput = ({ initialAge, onAgeChange, min, max, step, disabled }: AgeInputProps) => {
  const [currentAge, setCurrentAge] = React.useState<number>(initialAge ?? min);

  React.useEffect(() => {
    setCurrentAge(initialAge ?? min);
  }, [initialAge, min]);

  const handleSliderChange = (value: number[]) => {
    const newAge = value[0];
    setCurrentAge(newAge);
    onAgeChange(newAge);
  };

  return (
    <div className="space-y-4">
      <Label htmlFor="age-slider" className="text-base font-medium text-primary/90 block text-center">
        Idade: <span className="font-bold text-xl">{currentAge}</span> anos
      </Label>
      <Slider
        id="age-slider"
        value={[currentAge]}
        min={min}
        max={max}
        step={step}
        onValueChange={handleSliderChange}
        className="w-full"
        disabled={disabled}
      />
    </div>
  );
};