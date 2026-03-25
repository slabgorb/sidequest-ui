import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toRoman(n: number): string {
  const pairs: [number, string][] = [[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']];
  let result = '';
  for (const [value, numeral] of pairs) {
    while (n >= value) { result += numeral; n -= value; }
  }
  return result;
}
