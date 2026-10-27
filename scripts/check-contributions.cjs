#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function parseArgs(args) {
  let user = 'virtualVee';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') return {help:true};
    if (args[i] !== '--user' || !args[i+1]) throw new Error('Usage: npm run contributions:check -- [--user USERNAME]');
    user = args[++i];
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(user)) throw new Error('Invalid GitHub username.');
  return {user};
}

function createApi({fetchImpl = fetch, token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN} = {}) {
  return async endpoint => {
    const response = await fetchImpl(`https://api.github.com/${endpoint}`, {
      headers:{Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28',
        ...(token ? {Authorization:`Bearer ${token}`} : {})},
      signal:AbortSignal.timeout(30000), redirect:'error',
    });
    if (!response.ok) {
      // Do not print response bodies, request headers or credentials.
      const hint = [403,429].includes(response.status) ? ' API limit or access restriction; retry later or configure GH_TOKEN.' : '';
      throw new Error(`GitHub request failed (HTTP ${response.status}).${hint} No review file was written.`);
    }
    return response.json();
  };
}
const key = name => name.toLowerCase();
function repositoryName(value) {
  if (typeof value !== 'string' || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(value)) throw new Error('Invalid repository identity.');
  return value;
}
function date(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('GitHub returned an invalid date.');
  return value.slice(0,10);
}

async function checkContributions({user, existing, api, now = new Date()}) {
  if (existing.schema_version !== 1 || !Array.isArray(existing.repositories)) throw new Error('Unsupported contribution data schema.');
  const identities = new Map();
  const known = new Map();
  const slugs = new Set();
  for (const repo of existing.repositories) {
    const name = repositoryName(repo.repository);
    if (known.has(key(name)) || !repo.slug || slugs.has(repo.slug) || !Array.isArray(repo.contributions)) throw new Error('Duplicate or invalid recorded repository.');
    known.set(key(name), repo); slugs.add(repo.slug);
    for (const pr of repo.contributions) {
      if (!Number.isInteger(pr.number) || pr.number < 1) throw new Error('Invalid recorded PR number.');
      const id = `${key(name)}#${pr.number}`;
      if (identities.has(id)) throw new Error('Duplicate recorded PR.');
      identities.set(id,{name,number:pr.number});
    }
  }
  let total = 0;
  let received = 0;
  for (let page = 1; page <= 10; page++) {
    const query = `is:pr is:public author:${user} -user:${user}`;
    const result = await api(`search/issues?${new URLSearchParams({q:query,sort:'updated',order:'desc',per_page:'100',page:String(page)})}`);
    if (result.incomplete_results || !Number.isInteger(result.total_count) || !Array.isArray(result.items)) throw new Error('GitHub search was incomplete. Retry later; no review file was written.');
    total = result.total_count;
    if (total > 1000) throw new Error('GitHub search exceeds its 1,000-result limit. No partial review file was written. Narrowing large histories is not supported yet.');
    for (const item of result.items) {
      const match = /^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)$/.exec(item.repository_url || '');
      if (!match || !item.pull_request || !Number.isInteger(item.number) || item.number < 1) throw new Error('Unexpected GitHub search result.');
      const name = repositoryName(match[1]);
      if (key(name.split('/')[0]) !== key(user)) identities.set(`${key(name)}#${item.number}`,{name,number:item.number});
    }
    received += result.items.length;
    if (received >= total) break;
    if (!result.items.length || page === 10) throw new Error('GitHub pagination was incomplete. No review file was written.');
  }
  const repos = new Map();
  const review = [];
  // Preserve manually recorded history, even if it is not present in search results.
  for (const repo of existing.repositories) repos.set(key(repo.repository),structuredClone(repo));
  const metadata = new Map();
  let checked = 0;
  for (const {name,number} of identities.values()) {
    const repoKey = key(name);
    if (!metadata.has(repoKey)) {
      const meta = await api(`repos/${name}`);
      if (meta.private !== false || key(meta.full_name || '') !== repoKey) throw new Error('Repository is private, renamed or unavailable; review manually. No review file was written.');
      metadata.set(repoKey,meta);
    }
    const pr = await api(`repos/${name}/pulls/${number}`);
    if (pr.number !== number || key(pr.base?.repo?.full_name || '') !== repoKey || key(pr.user?.login || '') !== key(user)) throw new Error('Pull request identity or author does not match; review manually.');
    const status = pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : pr.draft ? 'draft' : 'open';
    if (!['open','closed'].includes(pr.state)) throw new Error('Unexpected GitHub pull request status.');
    let repo = repos.get(repoKey);
    if (!repo) {
      // Dot separates owner and name, avoiding ambiguous owner-name slug collisions.
      const slug = name.toLowerCase().replace('/', '.');
      if (slugs.has(slug)) throw new Error('Generated repository slug collides with existing data; choose a unique slug manually.');
      slugs.add(slug);
      repo = {slug,repository:name,url:`https://github.com/${name}`,description:metadata.get(repoKey).description || '',category:'',contributions:[]};
      repos.set(repoKey,repo);
      review.push({repository:name,reason:'Choose a category and review the repository description and open-source licence.'});
    }
    const previous = repo.contributions.find(item=>item.number === number);
    const contribution = {...previous,number,title:previous?.title || pr.title,description:previous?.description || '',
      date:date(pr.created_at),updated_at:date(pr.updated_at),status,url:`https://github.com/${name}/pull/${number}`};
    if (!contribution.description.trim()) review.push({repository:name,number,reason:'Write a factual contribution description.'});
    if (previous) Object.assign(previous,contribution); else repo.contributions.push(contribution);
    checked++;
  }
  const repositories = [...repos.values()].sort((a,b)=>a.repository.localeCompare(b.repository));
  for (const repo of repositories) repo.contributions.sort((a,b)=>b.updated_at?.localeCompare(a.updated_at || '') || b.number-a.number);
  const proposed = {schema_version:1,repositories};
  return {checked_at:now.toISOString(),user,scope:'Authored public pull requests in repositories owned by others; recorded PRs refreshed separately. Not commits, issues or reviews.',
    search_matches:total,checked_pull_requests:checked,changed:JSON.stringify(existing)!==JSON.stringify(proposed),review_required:review,proposed};
}

function formatSummary(report) {
  const lines = ['## Open source contribution check', '',
    `Checked: ${report.checked_at}`, '',
    `- Pull requests checked: **${report.checked_pull_requests}**`,
    `- Repositories: **${report.proposed.repositories.length}**`,
    `- Editorial review items: **${report.review_required.length}**`,
    `- Data changes: **${report.changed ? 'Proposal available for review' : 'None'}**`, '',
    'Scope: authored public PRs in repositories owned by others, plus previously recorded PRs. Issues, reviews and commits are excluded.', ''];
  if (!report.proposed.repositories.length) lines.push('No matching public pull requests were found.');
  for (const repo of report.proposed.repositories) {
    const counts = {open:0,draft:0,merged:0,closed:0};
    for (const pr of repo.contributions) if (pr.status in counts) counts[pr.status]++;
    lines.push(`- <https://github.com/${repositoryName(repo.repository)}>: ${Object.entries(counts).map(([status,count])=>`${count} ${status}`).join(', ')}`);
  }
  lines.push('', 'Download the **contribution-review** artifact from this run for the full JSON proposal. Reports are retained for 14 days.', '',
    'Review descriptions, categories, licences and links before applying any proposal. Public site data was not changed; nothing was committed or deployed.','');
  return lines.join('\n');
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log('Usage: npm run contributions:check -- [--user USERNAME]\nDefault: virtualVee. Reads public PRs only; writes an ignored local review file.\nOptional GH_TOKEN or GITHUB_TOKEN raises API limits. Never edits site data, commits or publishes.');
    return;
  }
  const existing = JSON.parse(fs.readFileSync(path.join(root,'data/contributions.json'),'utf8'));
  const report = await checkContributions({...options,existing,api:createApi()});
  const directory = path.join(root,'output/contributions');
  fs.mkdirSync(directory,{recursive:true});
  const output = path.join(directory,`review-${report.checked_at.replace(/[:.]/g,'-')}.json`);
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,formatSummary(report));
  console.log(`Checked ${report.checked_pull_requests} pull requests; ${report.proposed.repositories.length} repositories.\n${report.changed ? 'Changes available for review.' : 'No contribution data changes.'} ${report.review_required.length} editorial review items.\nReview file: ${output}\nPublic data unchanged. Review descriptions, categories, links and licence before copying proposed data into data/contributions.json.`);
}
if (require.main === module) main().catch(error=>{console.error(error.name === 'TimeoutError' ? 'GitHub request timed out. Retry later; public data unchanged.' : error.message);process.exitCode=1;});
module.exports = {parseArgs,createApi,checkContributions,formatSummary};
