const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {fixture}=require('./helpers/contribution-fixture.cjs');
for(const count of [0,1,4,5]) {
  test(`project lookup controls use published threshold: ${count}`,()=>{
    const f=fixture(0,{projectCount:count});
    try {
      const html=f.read('projects/index.html');
      assert.equal((html.match(/data-project-type=/g)||[]).length,count);
      for(const marker of ['id=project-search','id=project-sort','data-project-filters','data-project-filter-status','js/project-filters.js']) {
        assert.equal(html.includes(marker),count>=5,marker);
      }
      assert.equal(html.includes('Synthetic unpublished project'),false);
      if(count===4) {
        const source=path.join(f.scratch,'content/projects/portfolio/index.md');
        fs.writeFileSync(source,fs.readFileSync(source,'utf8').replace(/^updated_date:.*$/m,'updated_date: 2025-01-01'));
        f.build();
        const sorted=f.read('projects/index.html');
        assert.ok(sorted.indexOf('Babsy')<sorted.indexOf('Building this portfolio'),'server order follows updates, not project weights');
      }
    } finally {f.clean();}
  });
}
