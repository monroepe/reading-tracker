import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
export const legacyHeaders = ['Book','Author','Start','Finish','# Days','Book Length','Pages per Day','Kindle/Print','Rating'];
export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export async function exportReadings(userId: number, expanded: boolean): Promise<string> {
  const result = await db.execute(sql`select b.title, concat_ws(' ', nullif(a.first_name,''), nullif(a.middle_name,''), a.last_name) as author,
    r.started_on::text as start, r.finished_on::text as finish, r.date_uncertain, r.abandoned, b.page_count, r.format, r.rating, r.review,
    b.co_authors, b.category, g.name as genre, a.gender,
    (select string_agg(c.name, '; ' order by c.name) from author_countries ac join countries c on c.id=ac.country_id where ac.author_id=a.id) as countries,
    (select string_agg(t.name, '; ' order by t.name) from book_tags bt join tags t on t.id=bt.tag_id where bt.book_id=b.id and bt.user_id=${userId}) as tags,
    case when r.abandoned or r.date_uncertain then null else coalesce(r.finished_on,current_date)-r.started_on end as days
    from readings r join books b on b.id=r.book_id join authors a on a.id=b.author_id join genres g on g.id=b.genre_id
    where r.user_id=${userId} order by r.started_on,r.id`);
  const headers = expanded ? [...legacyHeaders,'Co-authors','Genre','Category','Author Countries','Author Gender','Tags','Review','Reading Status','Date Uncertain'] : legacyHeaders;
  const rows = result.rows.map(r => {
    const values: unknown[] = [r.title,r.author,r.date_uncertain ? null : r.start,r.date_uncertain ? null : r.finish,r.days,r.page_count,r.finish && Number(r.days)>0 ? Number((Number(r.page_count)/Number(r.days)).toFixed(1)) : null,r.format,r.rating == null ? null : Number(r.rating)];
    if (expanded) values.push(r.co_authors,r.genre,r.category,r.countries,r.gender,r.tags,r.review,r.abandoned ? 'Abandoned' : r.finish ? 'Completed' : 'In progress',r.date_uncertain ? 'Yes' : 'No');
    return values.map(csvCell).join(',');
  });
  return '\uFEFF' + [headers.map(csvCell).join(','),...rows].join('\r\n') + '\r\n';
}
