export function formatOutput(data: Record<string, unknown>, json: boolean): string {
  if (json) {
    return JSON.stringify(data, null, 2);
  }

  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    lines.push(`  ${label}: ${String(value)}`);
  }
  return lines.join("\n");
}

export function printSuccess(message: string, data: Record<string, unknown>, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ success: true, ...data }, null, 2));
  } else {
    console.log(`\n${message}\n`);
    console.log(formatOutput(data, false));
    console.log();
  }
}

export function printError(message: string, json: boolean, exitCode: number): void {
  if (json) {
    console.error(JSON.stringify({ success: false, error: message, exitCode }));
  } else {
    console.error(`\nError: ${message}\n`);
  }
}
