// PostgREST caps every unpaginated query at its configured max-rows (1000
// by default) with no error — past that, an unpaginated load silently
// returns a partial result. fetchAllRows() must page through with .range()
// until a short page signals the end. Verified by mocking supabaseClient to
// simulate a 2500-row table (well past the 1000-row page size) rather than
// actually inserting 2500 rows into the live test account.
const { chromium } = require('playwright');
const { login, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('pagination');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  await login(page, 'A', errors);

  const result = await page.evaluate(async () => {
    const TOTAL_ROWS = 2500; // spans 3 pages at the real REMOTE_PAGE_SIZE of 1000
    let callCount = 0;
    const rangesRequested = [];
    const realFrom = supabaseClient.from;
    supabaseClient.from = (table) => ({
      select: () => ({
        range: (from, to) => {
          callCount++;
          rangesRequested.push([from, to]);
          const pageSize = to - from + 1;
          const start = from;
          const end = Math.min(to + 1, TOTAL_ROWS);
          const data = start >= TOTAL_ROWS ? [] : Array.from({ length: end - start }, (_, i) => ({ id: 'row-' + (start + i), data: { id: 'row-' + (start + i) } }));
          return Promise.resolve({ data, error: null });
        },
      }),
    });

    let rows, error = null;
    try{
      rows = await fetchAllRows('some_table', 'id,data');
    }catch(e){ error = e.message; }

    supabaseClient.from = realFrom; // restore before any other code touches it
    return { rowCount: rows ? rows.length : 0, callCount, rangesRequested, error };
  });

  r.check('no error during paginated fetch', result.error, null);
  r.check('all 2500 rows across 3 pages are returned, not capped at 1000', result.rowCount, 2500);
  r.check('exactly 3 page requests were made (1000+1000+500)', result.callCount, 3);
  r.check('first page requested range [0, 999]', result.rangesRequested[0], [0, 999]);
  r.check('third (final, short) page requested range [2000, 2999]', result.rangesRequested[2], [2000, 2999]);

  r.checkEmpty('no console/page errors', errors);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
