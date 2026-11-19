import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import * as service from './analytics.service.js';

vi.mock('./db/index.js', () => ({ db: {}, pool: {} }));
vi.mock('./analytics.service.js');

const app = createApp();

type ReadingFormatCount = Awaited<ReturnType<typeof service.getReadingsByFormat>>[number];

const expectedResult: ReadingFormatCount[] = [
    { format: 'Print', count: 10 },
    { format: 'Kindle', count: 5 },
    { format: 'Audiobook', count: 3 },
    { format: 'Graphic Novel', count: 0 },
];

describe('GET /api/analytics/readings-by-format', () => {
    it('returns all four formats, including formats with zero readings', async () => {
        vi.mocked(service.getReadingsByFormat).mockResolvedValue(expectedResult);
        const res = await request(app).get('/api/analytics/readings-by-format');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expectedResult);
    });

    it('passes the current user ID to the service', async () => {
        vi.mocked(service.getReadingsByFormat).mockResolvedValue(expectedResult);
        await request(app).get('/api/analytics/readings-by-format');
        expect(service.getReadingsByFormat).toHaveBeenCalledWith(1, undefined);
    });

    it('passes the requested year to the service', async () => {
        vi.mocked(service.getReadingsByFormat).mockResolvedValue(expectedResult);
        const res = await request(app).get('/api/analytics/readings-by-format?year=2025');
        expect(res.status).toBe(200);
        expect(service.getReadingsByFormat).toHaveBeenCalledWith(1, 2025);
    });

    it.each([
        ['a non-numeric year', 'year=abc'],
        ['a year below 1900', 'year=1899'],
        ['a year above 2100', 'year=2101'],
        ['a non-integer year', 'year=2025.5'],
    ])('rejects %s', async (_name, query) => {
        const res = await request(app).get(`/api/analytics/readings-by-format?${query}`);
        expect(res.status).toBe(400);
        expect(service.getReadingsByFormat).not.toHaveBeenCalled();
    });
});

type ReadingCategoryCount = Awaited<ReturnType<typeof service.getReadingsByCategory>>[number];

const expectedCategoryResult: ReadingCategoryCount[] = [
    { category: 'Fiction', count: 120 },
    { category: 'Non-fiction', count: 73 },
];

describe('GET /api/analytics/readings-by-category', () => {
    it('returns the category counts', async () => {
        vi.mocked(service.getReadingsByCategory).mockResolvedValue(expectedCategoryResult);
        const res = await request(app).get('/api/analytics/readings-by-category');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expectedCategoryResult);
    });

    it('passes the current user ID to the service', async () => {
        vi.mocked(service.getReadingsByCategory).mockResolvedValue(expectedCategoryResult);
        await request(app).get('/api/analytics/readings-by-category');
        expect(service.getReadingsByCategory).toHaveBeenCalledWith(1, undefined);
    });

    it('passes the requested year to the service', async () => {
        vi.mocked(service.getReadingsByCategory).mockResolvedValue(expectedCategoryResult);
        const res = await request(app).get('/api/analytics/readings-by-category?year=2025');
        expect(res.status).toBe(200);
        expect(service.getReadingsByCategory).toHaveBeenCalledWith(1, 2025);
    });

    it.each([
        ['a non-numeric year', 'year=abc'],
        ['a year below 1900', 'year=1899'],
        ['a year above 2100', 'year=2101'],
        ['a non-integer year', 'year=2025.5'],
    ])('rejects %s', async (_name, query) => {
        const res = await request(app).get(`/api/analytics/readings-by-category?${query}`);
        expect(res.status).toBe(400);
        expect(service.getReadingsByCategory).not.toHaveBeenCalled();
    });
});

type ReadingGenreCount = Awaited<ReturnType<typeof service.getReadingsByGenre>>[number];

const expectedGenreResult: ReadingGenreCount[] = [
    { genre: 'Fantasy', count: 48 },
    { genre: 'Sci-Fi', count: 37 },
    { genre: 'Biography', count: 12 },
];

describe('GET /api/analytics/readings-by-genre', () => {
    it('returns the genre counts', async () => {
        vi.mocked(service.getReadingsByGenre).mockResolvedValue(expectedGenreResult);
        const res = await request(app).get('/api/analytics/readings-by-genre');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expectedGenreResult);
    });

    it('passes the current user ID to the service', async () => {
        vi.mocked(service.getReadingsByGenre).mockResolvedValue(expectedGenreResult);
        await request(app).get('/api/analytics/readings-by-genre');
        expect(service.getReadingsByGenre).toHaveBeenCalledWith(1, undefined);
    });

    it('passes the requested year to the service', async () => {
        vi.mocked(service.getReadingsByGenre).mockResolvedValue(expectedGenreResult);
        const res = await request(app).get('/api/analytics/readings-by-genre?year=2025');
        expect(res.status).toBe(200);
        expect(service.getReadingsByGenre).toHaveBeenCalledWith(1, 2025);
    });

    it.each([
        ['a non-numeric year', 'year=abc'],
        ['a year below 1900', 'year=1899'],
        ['a year above 2100', 'year=2101'],
        ['a non-integer year', 'year=2025.5'],
    ])('rejects %s', async (_name, query) => {
        const res = await request(app).get(`/api/analytics/readings-by-genre?${query}`);
        expect(res.status).toBe(400);
        expect(service.getReadingsByGenre).not.toHaveBeenCalled();
    });
});

type ReadingTagCount = Awaited<ReturnType<typeof service.getReadingsByTag>>[number];

const expectedTagResult: ReadingTagCount[] = [
    { tag: 'Fantasy', count: 48 },
    { tag: 'Found Family', count: 25 },
    { tag: 'Coming of Age', count: 12 },
];

describe('GET /api/analytics/readings-by-tag', () => {
    it('returns the tag counts', async () => {
        vi.mocked(service.getReadingsByTag).mockResolvedValue(expectedTagResult);
        const res = await request(app).get('/api/analytics/readings-by-tag');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expectedTagResult);
    });

    it('passes the current user ID to the service', async () => {
        vi.mocked(service.getReadingsByTag).mockResolvedValue(expectedTagResult);
        await request(app).get('/api/analytics/readings-by-tag');
        expect(service.getReadingsByTag).toHaveBeenCalledWith(1, undefined);
    });

    it('passes the requested year to the service', async () => {
        vi.mocked(service.getReadingsByTag).mockResolvedValue(expectedTagResult);
        const res = await request(app).get('/api/analytics/readings-by-tag?year=2025');
        expect(res.status).toBe(200);
        expect(service.getReadingsByTag).toHaveBeenCalledWith(1, 2025);
    });

    it.each([
        ['a non-numeric year', 'year=abc'],
        ['a year below 1900', 'year=1899'],
        ['a year above 2100', 'year=2101'],
        ['a non-integer year', 'year=2025.5'],
    ])('rejects %s', async (_name, query) => {
        const res = await request(app).get(`/api/analytics/readings-by-tag?${query}`);
        expect(res.status).toBe(400);
        expect(service.getReadingsByTag).not.toHaveBeenCalled();
    });
});

type ReadingGenderCount = Awaited<ReturnType<typeof service.getReadingsByGender>>[number];

const expectedGenderResult: ReadingGenderCount[] = [
    { gender: 'Male', count: 130 },
    { gender: 'Female', count: 63 },
];

describe('GET /api/analytics/readings-by-gender', () => {
    it('returns the gender counts', async () => {
        vi.mocked(service.getReadingsByGender).mockResolvedValue(expectedGenderResult);
        const res = await request(app).get('/api/analytics/readings-by-gender');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expectedGenderResult);
    });

    it('passes the current user ID to the service', async () => {
        vi.mocked(service.getReadingsByGender).mockResolvedValue(expectedGenderResult);
        await request(app).get('/api/analytics/readings-by-gender');
        expect(service.getReadingsByGender).toHaveBeenCalledWith(1, undefined);
    });

    it('passes the requested year to the service', async () => {
        vi.mocked(service.getReadingsByGender).mockResolvedValue(expectedGenderResult);
        const res = await request(app).get('/api/analytics/readings-by-gender?year=2025');
        expect(res.status).toBe(200);
        expect(service.getReadingsByGender).toHaveBeenCalledWith(1, 2025);
    });

    it.each([
        ['a non-numeric year', 'year=abc'],
        ['a year below 1900', 'year=1899'],
        ['a year above 2100', 'year=2101'],
        ['a non-integer year', 'year=2025.5'],
    ])('rejects %s', async (_name, query) => {
        const res = await request(app).get(`/api/analytics/readings-by-gender?${query}`);
        expect(res.status).toBe(400);
        expect(service.getReadingsByGender).not.toHaveBeenCalled();
    });
});

type ReadingYearCount = Awaited<ReturnType<typeof service.getReadingsByYear>>[number];

const expectedYearResult: ReadingYearCount[] = [
    { year: 2022, count: 40 },
    { year: 2023, count: 0 },
    { year: 2024, count: 55 },
];

describe('GET /api/analytics/readings-by-year', () => {
    it('returns the yearly counts', async () => {
        vi.mocked(service.getReadingsByYear).mockResolvedValue(expectedYearResult);
        const res = await request(app).get('/api/analytics/readings-by-year');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expectedYearResult);
    });

    it('passes the current user ID and no filters to the service', async () => {
        vi.mocked(service.getReadingsByYear).mockResolvedValue(expectedYearResult);
        await request(app).get('/api/analytics/readings-by-year');
        expect(service.getReadingsByYear).toHaveBeenCalledWith(1, {});
    });

    it('passes the requested format to the service', async () => {
        vi.mocked(service.getReadingsByYear).mockResolvedValue(expectedYearResult);
        const res = await request(app).get('/api/analytics/readings-by-year?format=Kindle');
        expect(res.status).toBe(200);
        expect(service.getReadingsByYear).toHaveBeenCalledWith(1, { format: 'Kindle' });
    });

    it('passes the requested genre ID to the service as a number', async () => {
        vi.mocked(service.getReadingsByYear).mockResolvedValue(expectedYearResult);
        const res = await request(app).get('/api/analytics/readings-by-year?genreId=7');
        expect(res.status).toBe(200);
        expect(service.getReadingsByYear).toHaveBeenCalledWith(1, { genreId: 7 });
    });

    it('passes the requested category to the service', async () => {
        vi.mocked(service.getReadingsByYear).mockResolvedValue(expectedYearResult);
        const res = await request(app).get('/api/analytics/readings-by-year?category=Non-fiction');
        expect(res.status).toBe(200);
        expect(service.getReadingsByYear).toHaveBeenCalledWith(1, { category: 'Non-fiction' });
    });

    it('passes all filters together to the service', async () => {
        vi.mocked(service.getReadingsByYear).mockResolvedValue(expectedYearResult);
        const res = await request(app).get(
            '/api/analytics/readings-by-year?format=Print&genreId=7&category=Fiction',
        );
        expect(res.status).toBe(200);
        expect(service.getReadingsByYear).toHaveBeenCalledWith(1, {
            format: 'Print',
            genreId: 7,
            category: 'Fiction',
        });
    });

    it.each([
        ['an unknown format', 'format=Scroll'],
        ['a non-numeric genre ID', 'genreId=abc'],
        ['a zero genre ID', 'genreId=0'],
        ['a negative genre ID', 'genreId=-1'],
        ['a non-integer genre ID', 'genreId=1.5'],
        ['an unknown category', 'category=Poetry'],
    ])('rejects %s', async (_name, query) => {
        const res = await request(app).get(`/api/analytics/readings-by-year?${query}`);
        expect(res.status).toBe(400);
        expect(service.getReadingsByYear).not.toHaveBeenCalled();
    });
});

type ReadingCountryCount = Awaited<ReturnType<typeof service.getReadingsByCountry>>[number];

const expectedCountryResult: ReadingCountryCount[] = [
    { country: 'United States', count: 90 },
    { country: 'United Kingdom', count: 40 },
    { country: 'Japan', count: 12 },
];

describe('GET /api/analytics/readings-by-country', () => {
    it('returns the country counts', async () => {
        vi.mocked(service.getReadingsByCountry).mockResolvedValue(expectedCountryResult);
        const res = await request(app).get('/api/analytics/readings-by-country');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expectedCountryResult);
    });

    it('passes the current user ID to the service', async () => {
        vi.mocked(service.getReadingsByCountry).mockResolvedValue(expectedCountryResult);
        await request(app).get('/api/analytics/readings-by-country');
        expect(service.getReadingsByCountry).toHaveBeenCalledWith(1, undefined);
    });

    it('passes the requested year to the service', async () => {
        vi.mocked(service.getReadingsByCountry).mockResolvedValue(expectedCountryResult);
        const res = await request(app).get('/api/analytics/readings-by-country?year=2025');
        expect(res.status).toBe(200);
        expect(service.getReadingsByCountry).toHaveBeenCalledWith(1, 2025);
    });

    it.each([
        ['a non-numeric year', 'year=abc'],
        ['a year below 1900', 'year=1899'],
        ['a year above 2100', 'year=2101'],
        ['a non-integer year', 'year=2025.5'],
    ])('rejects %s', async (_name, query) => {
        const res = await request(app).get(`/api/analytics/readings-by-country?${query}`);
        expect(res.status).toBe(400);
        expect(service.getReadingsByCountry).not.toHaveBeenCalled();
    });
});