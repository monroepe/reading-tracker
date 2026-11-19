import type { ReadData } from '@/data/readData';
import type { Reading, BookDetail } from '@/api/types';
import type { ReadingPeriod } from '@/lib/readingPeriod';
import { rankReviewReadings } from './reviewRanking';

export function localAnalytics(readings: Reading[], books: BookDetail[]): NonNullable<ReadData['analytics']> {
 const completed = readings.filter(r => !r.abandoned && r.finishedOn !== null);
 const period = (r: Reading, year?: ReadingPeriod) => year === undefined || (year === 'pre-2022' ? r.finishedOn! < '2022-01-01' : !r.dateUncertain && Number(r.finishedOn!.slice(0,4)) === year);
 const counts = (values: string[]) => [...new Set(values)].map(name => ({name, count: values.filter(v => v === name).length})).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name));
 const byFormat = async (year?: ReadingPeriod) => (['Print','Kindle','Audiobook','Graphic Novel'] as const).map(format => ({format, count: completed.filter(r => period(r,year) && r.format === format).length}));
 return {
 byFormat,
 byCategory: async year => counts(completed.filter(r => period(r,year)).map(r => r.book.category)).sort((a,b) => a.name.localeCompare(b.name)).map(r => ({category:r.name as 'Fiction'|'Non-fiction',count:r.count})),
 byGenre: async year => counts(completed.filter(r => period(r,year)).map(r => r.genre.name)).map(r => ({genre:r.name,count:r.count})),
 byTag: async year => counts(completed.filter(r => period(r,year)).flatMap(r => (books.find(b => b.id === r.book.id)?.tags ?? []).map(t => t.name))).map(r => ({tag:r.name,count:r.count})),
 byYear: async filters => {
 const rows = completed.filter(r => (!filters.format || r.format === filters.format) && (!filters.genreId || r.genre.id === filters.genreId) && (!filters.category || r.book.category === filters.category));
 const years = rows.map(r => Math.max(2021,Number(r.finishedOn!.slice(0,4))));
 if (!years.length) return [];
 return Array.from({length: Math.max(...years)-Math.min(...years)+1},(_,i) => { const year = Math.min(...years)+i; return {year: year === 2021 ? 'pre-2022' as const : year,count: years.filter(y => y === year).length}; });
 },
 topAuthors: async (sort,include) => {
 const rows = completed.filter(r => include || r.format !== 'Graphic Novel');
 const average = (rs: Reading[]) => {const ratings=rs.flatMap(r => r.rating === null ? [] : [r.rating]);return ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null;};
 const overall=average(rows);
 return [...new Set(rows.map(r=>r.author.id))].map(id=>{const rs=rows.filter(r=>r.author.id===id);const a=rs[0].author;const bookCount=new Set(rs.map(r=>r.book.id)).size;const averageRating=average(rs);return {authorId:id,firstName:a.firstName,middleName:a.middleName,lastName:a.lastName,bookCount,averageRating,weightedScore:averageRating === null || overall === null ? null : (bookCount*averageRating+3*overall)/(bookCount+3)};}).filter(a=>sort!=='rating'||a.averageRating!==null).sort((a,b)=>(sort==='rating' ? (b.weightedScore ?? -Infinity)-(a.weightedScore ?? -Infinity)||b.bookCount-a.bookCount : b.bookCount-a.bookCount||(b.averageRating ?? -Infinity)-(a.averageRating ?? -Infinity))||a.lastName.toLowerCase().localeCompare(b.lastName.toLowerCase())||a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase())||a.middleName.toLowerCase().localeCompare(b.middleName.toLowerCase())||a.authorId-b.authorId).slice(0,10);
 },
 review: async (year,options) => {
 const rows=completed.filter(r=>period(r,year));
 return {year,total:rows.length,totalPages:rows.reduce((sum,r)=>sum+r.book.pageCount,0),...rankReviewReadings(rows.map(r=>({readingId:r.id,bookId:r.book.id,title:r.book.title,authorId:r.author.id,...r.author,format:r.format,finishedOn:r.finishedOn!,rating:r.rating,pageCount:r.book.pageCount})),options),byFormat:await byFormat(year),byCategory:counts(rows.map(r=>r.book.category)).sort((a,b)=>a.name.localeCompare(b.name)).map(r=>({category:r.name as 'Fiction'|'Non-fiction',count:r.count})),byGenre:counts(rows.map(r=>r.genre.name)).map(r=>({genre:r.name,count:r.count})),byTag:counts(rows.flatMap(r=>books.find(b=>b.id===r.book.id)!.tags.map(t=>t.name))).map(r=>({tag:r.name,count:r.count}))};
 }
 };
}
