export function comparePhrase(deltaKt: number, unitLabel: string): string {
  const n = Math.round(deltaKt);
  if (n === 0) return `Matching the forecast this hour`;
  if (n > 0) return `Airport is ${n} ${unitLabel} windier than the forecast`;
  return `Airport is ${Math.abs(n)} ${unitLabel} lighter than the forecast`;
}

export function dayBiasPhrase(meanKt: number, hours: number): string {
  const n = Math.round(meanKt);
  const window = `${hours} hour${hours === 1 ? "" : "s"}`;
  if (Math.abs(n) <= 1) {
    return `Last day · forecast was close (${window})`;
  }
  if (n > 0) {
    return `Last day · airport ran about ${n} kt windier than the model (${window})`;
  }
  return `Last day · airport ran about ${Math.abs(n)} kt lighter than the model (${window})`;
}
