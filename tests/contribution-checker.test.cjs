const {test} = require('node:test');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const {parseArgs,createApi,checkContributions,formatSummary} = require('../scripts/check-contributions.cjs');
const empty = ()=>({schema_version:1,repositories:[]});
const item = (number=1)=>({number,repository_url:'https://api.github.com/repos/upstream/tool',pull_request:{}});
const pr = (number=1,extra={})=>({number,title:`PR ${number}`,created_at:'2026-01-02T12:00:00Z',updated_at:'2026-02-03T12:00:00Z',state:'open',draft:false,merged_at:null,user:{login:'virtualVee'},base:{repo:{full_name:'upstream/tool'}},...extra});
const repo = ()=>({full_name:'upstream/tool',private:false,description:'Repository description'});
const search = items=>({total_count:items.length,incomplete_results:false,items});
function apiWith({items=[item()],metadata=repo(),pull=pr(),searchResult}={}) {
  return async endpoint=> endpoint.startsWith('search/') ? searchResult || search(items) : endpoint.includes('/pulls/') ? typeof pull === 'function' ? pull(Number(endpoint.split('/').at(-1))) : pull : metadata;
}
async function run(api,existing=empty()) {return checkContributions({user:'virtualVee',existing,api,now:new Date('2026-10-27T09:00:00Z')});}

test('checker has explicit CLI options and harmless help',()=>{
  assert.deepEqual(parseArgs([]),{user:'virtualVee'});
  assert.deepEqual(parseArgs(['--user','Someone']),{user:'Someone'});
  for (const args of [['--write'],['--user'],['--user','name is:private']]) assert.throws(()=>parseArgs(args));
  const output=execFileSync(process.execPath,[path.resolve(__dirname,'../scripts/check-contributions.cjs'),'--help'],{encoding:'utf8'});
  assert.match(output,/Never edits site data/);
});
test('zero results leave an empty proposal without fabricated entries',async()=>{
  const report=await run(apiWith({items:[]}));
  assert.deepEqual(report.proposed,empty());assert.equal(report.changed,false);assert.equal(report.checked_pull_requests,0);
});
test('new public PRs use verified metadata and leave editorial fields blank',async()=>{
  const report=await run(apiWith());
  const repository=report.proposed.repositories[0];
  assert.equal(repository.repository,'upstream/tool');assert.equal(repository.category,'');
  assert.equal(repository.description,'Repository description');assert.equal(repository.contributions[0].description,'');
  assert.equal(repository.contributions[0].date,'2026-01-02');assert.equal(repository.contributions[0].updated_at,'2026-02-03');
  assert.equal(repository.contributions[0].url,'https://github.com/upstream/tool/pull/1');assert.equal(report.review_required.length,2);
});
test('PR states distinguish open, draft, merged and closed',async()=>{
  for (const [extra,status] of [[{},'open'],[{draft:true},'draft'],[{state:'closed',draft:true},'closed'],[{state:'closed',merged_at:'2026-02-03'},'merged']]) {
    const report=await run(apiWith({pull:pr(1,extra)}));assert.equal(report.proposed.repositories[0].contributions[0].status,status);
  }
});
test('recorded history is refreshed even when absent from search and curated fields survive',async()=>{
  const existing={schema_version:1,repositories:[{slug:'stable-slug',repository:'upstream/tool',url:'https://github.com/upstream/tool',category:'Tools',description:'Curated repository',case_study:'/projects/portfolio',contributions:[{number:1,title:'Curated title',description:'Written by me',date:'2026-01-02',updated_at:'2026-01-02',status:'open',url:'https://github.com/upstream/tool/pull/1'}]}]};
  const original=structuredClone(existing);
  const report=await run(apiWith({items:[],pull:pr(1,{state:'closed',merged_at:'2026-02-03'})}),existing);
  assert.deepEqual(existing,original);
  const result=report.proposed.repositories[0];
  for(const field of ['slug','category','description','case_study']) assert.equal(result[field],existing.repositories[0][field]);
  assert.equal(result.contributions[0].title,'Curated title');assert.equal(result.contributions[0].description,'Written by me');assert.equal(result.contributions[0].status,'merged');
  assert.deepEqual(report.review_required,[]);
});
test('pagination retrieves all results, groups by repository and deduplicates PRs',async()=>{
  let pages=0,metadataCalls=0;
  const report=await run(async endpoint=>{
    if(endpoint.startsWith('search/')) {pages++;return {total_count:101,incomplete_results:false,items:pages===1?Array.from({length:100},(_,i)=>item(i+1)):[item(101)]};}
    if(endpoint.includes('/pulls/')) return pr(Number(endpoint.split('/').at(-1)));
    metadataCalls++;return repo();
  });
  assert.equal(pages,2);assert.equal(metadataCalls,1);assert.equal(report.checked_pull_requests,101);assert.equal(report.proposed.repositories.length,1);assert.equal(report.proposed.repositories[0].contributions.length,101);
  const duplicate=await run(apiWith({items:[item(),item()]}));assert.equal(duplicate.checked_pull_requests,1);
});
test('own repositories are excluded case-insensitively',async()=>{
  const own={...item(),repository_url:'https://api.github.com/repos/VirtualVee/portfolio'};
  const report=await run(apiWith({items:[own]}));assert.deepEqual(report.proposed,empty());
});
test('private, renamed, mismatched-author and invalid PR responses fail closed',async()=>{
  for (const options of [{metadata:{...repo(),private:true}},{metadata:{...repo(),full_name:'renamed/tool'}},{pull:pr(1,{user:{login:'someone'}})},{pull:pr(2)},{pull:pr(1,{updated_at:'invalid'})}]) {
    await assert.rejects(run(apiWith(options)));
  }
});
test('incomplete, over-limit, truncated and malformed searches do not return proposals',async()=>{
  for(const result of [{...search([]),incomplete_results:true},{...search([]),total_count:1001},{...search([]),total_count:1},{...search([{}])}]) await assert.rejects(run(apiWith({searchResult:result})));
});
test('unsupported data and duplicate repository/PR identities are rejected',async()=>{
  await assert.rejects(run(apiWith(),{schema_version:2,repositories:[]}));
  const recorded={slug:'s',repository:'upstream/tool',contributions:[{number:1},{number:1}]};
  await assert.rejects(run(apiWith(),{schema_version:1,repositories:[recorded]}));
  await assert.rejects(run(apiWith(),{schema_version:1,repositories:[{...recorded,contributions:[]},{...recorded,contributions:[]}]}));
});
test('HTTP requests use GET defaults, fixed GitHub host and optional token without leaking failures',async()=>{
  let request;
  const api=createApi({token:'test-only-secret',fetchImpl:async(url,options)=>{request={url,options};return {ok:false,status:429};}});
  await assert.rejects(api('search/issues?q=test'),error=>!error.message.includes('test-only-secret')&&error.message.includes('API limit'));
  assert.equal(request.url,'https://api.github.com/search/issues?q=test');assert.equal(request.options.headers.Authorization,'Bearer test-only-secret');assert.equal(request.options.redirect,'error');
  const anonymous=createApi({token:'',fetchImpl:async(url,options)=>{assert.equal(options.headers.Authorization,undefined);return {ok:true,json:async()=>({ok:true})};}});
  assert.deepEqual(await anonymous('search/issues'),{ok:true});
});

test('phone run summary reports zero results without a public placeholder',async()=>{
  const summary=formatSummary(await run(apiWith({items:[]})));
  assert.match(summary,/Pull requests checked: \*\*0\*\*/);
  assert.match(summary,/No matching public pull requests/);
  assert.match(summary,/Public site data was not changed/);
  assert.match(summary,/contribution-review/);
});
test('phone run summary links repositories and counts verified statuses without copying PR text',async()=>{
  const report=await run(apiWith({items:[item(1),item(2)],pull:number=>pr(number,{title:'<script>untrusted</script>',...(number===1?{state:'closed',merged_at:'2026-02-03'}:{draft:true})})}));
  const summary=formatSummary(report);
  assert.match(summary,/<https:\/\/github.com\/upstream\/tool>/);
  assert.match(summary,/0 open, 1 draft, 1 merged, 0 closed/);
  assert.equal(summary.includes('untrusted'),false);
});

test('CLI writes the GitHub run summary and review report without changing public data',()=>{
  const fs=require('node:fs');
  const os=require('node:os');
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'contribution-summary-'));
  try {
    fs.mkdirSync(path.join(scratch,'scripts'));fs.mkdirSync(path.join(scratch,'data'));
    fs.copyFileSync(path.resolve(__dirname,'../scripts/check-contributions.cjs'),path.join(scratch,'scripts/check-contributions.cjs'));
    const original=JSON.stringify(empty());
    fs.writeFileSync(path.join(scratch,'data/contributions.json'),original);
    fs.writeFileSync(path.join(scratch,'mock.cjs'),`global.fetch=async()=>({ok:true,json:async()=>({total_count:0,incomplete_results:false,items:[]})});`);
    const summaryFile=path.join(scratch,'summary.md');
    execFileSync(process.execPath,['--require',path.join(scratch,'mock.cjs'),path.join(scratch,'scripts/check-contributions.cjs')],{
      env:{...process.env,GH_TOKEN:'',GITHUB_TOKEN:'',GITHUB_STEP_SUMMARY:summaryFile},stdio:'pipe',
    });
    assert.match(fs.readFileSync(summaryFile,'utf8'),/No matching public pull requests/);
    assert.equal(fs.readdirSync(path.join(scratch,'output/contributions')).length,1);
    assert.equal(fs.readFileSync(path.join(scratch,'data/contributions.json'),'utf8'),original);
  } finally {fs.rmSync(scratch,{recursive:true,force:true});}
});
