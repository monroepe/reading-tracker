import { expect, it } from 'vitest';
import { authorInput, authorUpdate } from './authors.schemas.js';

it('accepts and trims full middle names and initials', () => {
  expect(authorInput.parse({ firstName: ' John ', middleName: ' R. R. ', lastName: ' Tolkien ' }))
    .toEqual({ firstName: 'John', middleName: 'R. R.', lastName: 'Tolkien' });
  expect(authorInput.parse({ middleName: ' Mary ', lastName: 'Smith' }).middleName).toBe('Mary');
});

it('leaves omitted middle names unset and permits clearing one', () => {
  expect(authorInput.parse({ lastName: 'Voltaire' })).not.toHaveProperty('middleName');
  expect(authorUpdate.parse({ middleName: '  ' })).toEqual({ middleName: '' });
  expect(authorUpdate.parse({ countryIds: [1] })).not.toHaveProperty('middleName');
});

it('rejects null middle names and blank required last names', () => {
  expect(authorInput.safeParse({ middleName: null, lastName: 'Smith' }).success).toBe(false);
  expect(authorInput.safeParse({ lastName: '\t ' }).success).toBe(false);
});
