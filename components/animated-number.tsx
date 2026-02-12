"use client";

import { useCountUp } from "@/hooks/use-count-up";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 2000,
  className,
}: AnimatedNumberProps) {
  const animated = useCountUp(value, duration);

  return <span className={className}>{animated}</span>;
}
