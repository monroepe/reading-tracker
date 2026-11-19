export function exportFilename(purpose: string, createdAt: string, extension = 'json'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(createdAt));
  const value = (name: string) => parts.find(part => part.type === name)!.value;
  return `reading-tracker-${purpose}-${value('year')}-${value('month')}-${value('day')}_${value('hour')}${value('minute')}${value('second')}.${extension}`;
}
