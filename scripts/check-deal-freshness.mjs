import fs from 'node:fs/promises';

const STALE_DAYS = Number(process.env.STALE_DAYS || 45);
const TIMEOUT_MS = Number(process.env.LINK_TIMEOUT_MS || 12000);
const sourcePath = new URL('../data/deals.json', import.meta.url);
const deals = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
const now = new Date();

function ageDays(value) {
  if (!value) return Infinity;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? Infinity : Math.max(0, Math.floor((now - d) / 86400000));
}

function expired(value) {
  if (!value) return false;
  const d = new Date(`${value}T23:59:59Z`);
  return !Number.isNaN(d.getTime()) && d < now;
}

async function checkUrl(url) {
  if (!/^https?:\/\//i.test(String(url || ''))) return { ok: false, status: 0, note: 'invalid URL' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers = { 'user-agent': 'TeacherTreasureFreshnessBot/1.0 (+https://github.com/duhfreakinduh/teacher-treasure)' };
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers });
    if ([400, 403, 405, 429].includes(response.status)) {
      response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { ...headers, range: 'bytes=0-2048' } });
    }
    const blockedButReachable = [401, 403, 429].includes(response.status);
    return {
      ok: response.ok || blockedButReachable,
      status: response.status,
      finalUrl: response.url,
      note: blockedButReachable ? 'site blocks or rate-limits automated checks; manual review may still be needed' : ''
    };
  } catch (error) {
    return { ok: false, status: 0, note: error?.name === 'AbortError' ? 'timeout' : String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

const rows = [];
for (const deal of deals) {
  const age = ageDays(deal.lastVerified);
  const link = await checkUrl(deal.url);
  const problems = [];
  if (expired(deal.expires)) problems.push(`expired ${deal.expires}`);
  if (deal.verificationStatus === 'verified' && age > STALE_DAYS) problems.push(`verification is ${age} days old`);
  if (!link.ok) problems.push(`official link check failed${link.status ? ` (HTTP ${link.status})` : ''}: ${link.note}`);
  rows.push({
    id: deal.id,
    organization: deal.organization,
    title: deal.title,
    url: deal.url,
    verificationStatus: deal.verificationStatus,
    lastVerified: deal.lastVerified || null,
    ageDays: Number.isFinite(age) ? age : null,
    expires: deal.expires || null,
    link,
    problems
  });
}

const actionable = rows.filter(row => row.problems.length);
const report = {
  checkedAt: now.toISOString(),
  staleAfterDays: STALE_DAYS,
  total: rows.length,
  actionableCount: actionable.length,
  actionable,
  rows
};

await fs.writeFile('freshness-report.json', JSON.stringify(report, null, 2));

const summary = [
  '# Teacher Treasure freshness check',
  '',
  `Checked: ${report.checkedAt}`,
  `Listings: ${report.total}`,
  `Needs review: ${report.actionableCount}`,
  '',
  ...(actionable.length
    ? actionable.map(row => `- **${row.organization} — ${row.title}**: ${row.problems.join('; ')}`)
    : ['- No listings crossed the freshness, expiration, or link-health review thresholds.'])
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
console.log(summary);
