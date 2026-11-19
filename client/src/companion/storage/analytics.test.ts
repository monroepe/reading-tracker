import { describe, expect, it } from 'vitest';
import { localAnalytics } from '@/data/libraryAnalytics';

describe('local analytics', () => {
 it('returns empty reports without requiring a server', async () => {
  const analytics = localAnalytics([], []);
  expect(await analytics.byYear({})).toEqual([]);
  expect(await analytics.topAuthors('rating', false)).toEqual([]);
  expect(await analytics.byFormat()).toHaveLength(4);
  expect(await analytics.review(2026, {includeGraphicNovelsInBooks:false,includeGraphicNovelsInAuthors:false})).toMatchObject({total:0,totalPages:0,topBooks:[],topAuthors:[],byTag:[]});
 });
});

import type { Reading } from '@/api/types';
const reading = (overrides: Partial<Reading> = {}): Reading => ({
 id:1, startedOn:'2024-01-01', finishedOn:'2024-01-10', dateUncertain:false, abandoned:false, format:'Print',rating:8,review:null,days:9,
 book:{id:1,title:'Book',coAuthors:null,category:'Fiction',pageCount:100}, author:{id:1,firstName:'An',middleName:'',lastName:'Author'},genre:{id:1,name:'Fiction'},...overrides,
});
it('counts rereads but ranks authors by unique books and averages all ratings', async () => {
 const analytics=localAnalytics([reading(),reading({id:2,rating:10}),reading({id:3,abandoned:true}),reading({id:4,finishedOn:null})],[]);
 expect(await analytics.byFormat()).toContainEqual({format:'Print',count:2});
 expect(await analytics.topAuthors('books',false)).toMatchObject([{bookCount:1,averageRating:9,weightedScore:9}]);
});
it('groups historical dates, fills missing years and applies filters', async () => {
 const analytics=localAnalytics([reading({finishedOn:'2020-01-01',dateUncertain:true}),reading()],[]);
 expect(await analytics.byYear({})).toEqual([{year:'pre-2022',count:1},{year:2022,count:0},{year:2023,count:0},{year:2024,count:1}]);
 expect(await analytics.byYear({format:'Kindle'})).toEqual([]);
 expect(await analytics.byFormat(2020)).toContainEqual({format:'Print',count:0});
 expect(await analytics.byFormat('pre-2022')).toContainEqual({format:'Print',count:1});
});
it('excludes graphic novels from author rankings by default', async () => {
 const analytics=localAnalytics([reading({format:'Graphic Novel'})],[]);
 expect(await analytics.topAuthors('books',false)).toEqual([]);
 expect(await analytics.topAuthors('books',true)).toHaveLength(1);
});

it('provides offline breakdowns with period filtering and current multi-tag assignments', async () => {
 const book = {id:1,tags:[{id:1,name:'Favorite'},{id:2,name:'History'}]} as import('@/api/types').BookDetail;
 const analytics = localAnalytics([reading(),reading({id:2}),reading({id:3,abandoned:true}),reading({id:4,finishedOn:null}),reading({id:5,finishedOn:'2020-01-01',dateUncertain:true})],[book]);
 expect(await analytics.byCategory(2024)).toEqual([{category:'Fiction',count:2}]);
 expect(await analytics.byGenre('pre-2022')).toEqual([{genre:'Fiction',count:1}]);
 expect(await analytics.byTag()).toEqual([{tag:'Favorite',count:3},{tag:'History',count:3}]);
 expect(await analytics.byTag(2023)).toEqual([]);
 expect(await localAnalytics([reading()],[]).byTag()).toEqual([]);
 expect(await localAnalytics([],[]).byCategory()).toEqual([]);
 expect(await analytics.byGenre(2020)).toEqual([]);
});
