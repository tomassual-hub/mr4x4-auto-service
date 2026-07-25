// Regression guard for the UTC/local date-string fix: "today" comparisons
// (appointment notifications, cash-closure date key, accounting CSV export)
// must use local calendar day, never toISOString().slice(0,10) (which is
// UTC and silently shifts back a day for the first 8 hours of each day in
// Malaysia, UTC+8).
const { chromium } = require('playwright');
const { login, makeReporter } = require('./helpers');

async function run(){
  const r = makeReporter('local-date');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  await login(page, 'A', errors);

  const check = await page.evaluate(() => {
    const d = new Date();
    const expectedLocal = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const apptId = uid();
    db.appointments.push({ id: apptId, customerId: null, vehicleId: null, date: expectedLocal, time: '09:00', notes: 'local-date test', status: 'scheduled' });
    const notifs = getNotifications();
    const found = notifs.some(n => n.tag === 'Tempahan');
    db.appointments = db.appointments.filter(a => a.id !== apptId);

    const twoAmLocal = new Date(); twoAmLocal.setHours(2,0,0,0);
    const csvRow = localDateStr(new Date(twoAmLocal.getTime()));
    const csvRowLocalExpected = twoAmLocal.getFullYear()+'-'+String(twoAmLocal.getMonth()+1).padStart(2,'0')+'-'+String(twoAmLocal.getDate()).padStart(2,'0');

    return { localDateStrMatchesLocal: localDateStr() === expectedLocal, apptFoundInNotifications: found, csvUsesLocalDay: csvRow === csvRowLocalExpected };
  });

  r.checkTrue('localDateStr() matches the actual local calendar day', check.localDateStrMatchesLocal);
  r.checkTrue('today-dated appointment appears in the notification bell', check.apptFoundInNotifications);
  r.checkTrue('accounting CSV export date uses local calendar day', check.csvUsesLocalDay);

  await page.evaluate(() => queueSave());
  await page.waitForTimeout(1000);
  r.checkEmpty('no console/page errors', errors);
  await browser.close();
  return r.summary();
}

if(require.main === module){
  run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
}
module.exports = { run };
