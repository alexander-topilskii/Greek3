function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** DDMMYYYY.HHmm — дата и время сборки для отображения в UI */
export function formatBuildVersion(date = new Date()): string {
  return `${pad(date.getDate())}${pad(date.getMonth() + 1)}${date.getFullYear()}.${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export const BUILD_VERSION = process.env.BUILD_VERSION ?? formatBuildVersion();
