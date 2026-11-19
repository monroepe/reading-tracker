export const readingFormats = [
  'Print',
  'Kindle',
  'Audiobook',
  'Graphic Novel',
] as const;

export type ReadingFormat = (typeof readingFormats)[number];

export type ReadingFormValues = {
  bookId: number;
  startedOn: string;
  format: ReadingFormat;
  finishedOn: string | null;
  rating: number | null;
  review: string | null;
};

export type Reading = ReadingFormValues & {
  id: number;
  bookTitle: string;
};