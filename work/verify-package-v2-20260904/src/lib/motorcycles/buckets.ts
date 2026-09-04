export function ccBucket(value: number): string {
  if (value <= 200) return "CC0-200";
  if (value <= 400) return "CC201-400";
  if (value <= 650) return "CC401-650";
  if (value <= 900) return "CC651-900";
  if (value <= 1200) return "CC901-1200";
  return "CC1200+";
}

export function mileageBucket(value: number | null): string {
  if (value === null) return "M-NA";
  if (value < 20_000) return "M0-20K";
  if (value < 40_000) return "M20-40K";
  if (value < 80_000) return "M40-80K";
  if (value < 120_000) return "M80-120K";
  return "M120K+";
}

export function ageBucket(value: number | null): string {
  if (value === null) return "AGE-NA";
  if (value < 3) return "AGE0-3";
  if (value < 6) return "AGE3-6";
  if (value < 10) return "AGE6-10";
  if (value < 15) return "AGE10-15";
  return "AGE15+";
}

export function coeBucket(value: number | null): string {
  if (value === null) return "COE-NA";
  if (value < 2) return "COE0-2";
  if (value < 5) return "COE2-5";
  if (value < 8) return "COE5-8";
  if (value < 10) return "COE8-10";
  return "COE10+";
}
