import { expect, it } from 'vitest';
import { exportFilename } from './exportFilename';
it('uses Central time and compact seconds', () => {
  expect(exportFilename('phone-changes', '2026-11-12T03:30:45Z')).toBe('reading-tracker-phone-changes-2026-11-11_213045.json');
  expect(exportFilename('readings-legacy', '2026-07-12T02:30:45Z', 'csv')).toBe('reading-tracker-readings-legacy-2026-07-11_213045.csv');
});
