export function formatAuthor(author: { firstName: string; middleName: string; lastName: string }): string {
  return [author.firstName, author.middleName, author.lastName].filter(Boolean).join(' ');
}
