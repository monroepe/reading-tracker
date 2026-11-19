import { Router } from 'express';
import { currentUserId } from '../middleware/auth.js';
import * as service from './analytics.service.js';
import { analyticsQuery, readingsByYearQuery, topAuthorsQuery, topBooksQuery, yearInReviewQuery } from './analytics.schema.js';
import { getYearInReview } from './year-in-review.service.js';

export const analyticsRouter = Router();

analyticsRouter.get('/top-books', async (req, res) => {
    const filters = topBooksQuery.parse(req.query);
    res.json(await service.getTopBooks(currentUserId(req), filters));
});

analyticsRouter.get('/top-authors', async (req, res) => {
    const { sort, includeGraphicNovels } = topAuthorsQuery.parse(req.query);
    const result = await service.getTopAuthors(currentUserId(req), sort, includeGraphicNovels);
    res.json(result);
});

analyticsRouter.get('/readings-by-format', async (req, res) => {
    const { year } = analyticsQuery.parse(req.query);
    const result = await service.getReadingsByFormat(currentUserId(req), year);
    res.json(result);
});

analyticsRouter.get('/readings-by-year', async (req, res) => {
    const filters = readingsByYearQuery.parse(req.query);
    const result = await service.getReadingsByYear(currentUserId(req), filters);
    res.json(result);
});

analyticsRouter.get('/readings-by-category', async (req, res) => {
    const { year } = analyticsQuery.parse(req.query);
    const result = await service.getReadingsByCategory(currentUserId(req), year);
    res.json(result);
});

analyticsRouter.get('/readings-by-genre', async (req, res) => {
    const { year } = analyticsQuery.parse(req.query);
    const result = await service.getReadingsByGenre(currentUserId(req), year);
    res.json(result);
});

analyticsRouter.get('/readings-by-tag', async (req, res) => {
    const { year } = analyticsQuery.parse(req.query);

    const result = await service.getReadingsByTag(currentUserId(req), year);

    res.json(result);
});

analyticsRouter.get('/readings-by-gender', async (req, res) => {
    const { year } = analyticsQuery.parse(req.query);
    const result = await service.getReadingsByGender(currentUserId(req), year);
    res.json(result);
});

analyticsRouter.get('/readings-by-country', async (req, res) => {
    const { year } = analyticsQuery.parse(req.query);
    const result = await service.getReadingsByCountry(currentUserId(req), year);
    res.json(result);
});

analyticsRouter.get('/year-in-review', async (req, res) => {
    const query = yearInReviewQuery.parse(req.query);
    res.json(await getYearInReview(currentUserId(req), query));
});
