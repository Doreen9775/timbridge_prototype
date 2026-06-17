// Board-foot math (kickoff §5). FBM = thickness × width × length × qty ÷ 12.
export function calcFbm(thick: number, width: number, length: number, qty: number): number {
  return Math.round((thick * width * length * qty) / 12);
}

export function calcLineal(length: number, qty: number): number {
  return length * qty;
}

// Cubic metres from board feet (1 FBM ≈ 0.002359737 m³).
export function fbmToM3(fbm: number): string {
  return (fbm * 0.002359737).toFixed(2);
}
