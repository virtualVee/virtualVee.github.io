const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {fixture} = require('./helpers/contribution-fixture.cjs');
let baseline;
for (const count of [0,1,3,4,6,7]) {
  test(`contribution production build with ${count} repositories`, () => {
    const f = fixture(count);
    try {
      const projects = f.read('projects/index.html');
      const projectSection = projects.match(/<section class="section projects-section">[\s\S]*?<\/section>/)[0];
      if (count === 0) baseline = projectSection;
      else assert.equal(projectSection, baseline, 'existing Projects markup is unchanged');
      assert.equal((projects.match(/class="project-card contribution-card"/g)||[]).length,Math.min(3,count));
      assert.equal(projects.includes('View all contributions'),count >= 4);
      if (!count) {
        assert.equal(projects.includes('Synthetic unpublished project'),false);
        assert.equal(fs.existsSync(path.join(f.output,'projects/fixture-draft/index.html')),false);
        assert.equal(projects.includes('Open Source Contributions'),false);
        assert.equal(fs.existsSync(path.join(f.output,'contributions')),false);
        for (const file of ['sitemap.xml','index.xml']) assert.equal(f.read(file).includes('/contributions/'),false);
        // Empty repository records also must not publish pages or the section.
        fs.writeFileSync(path.join(f.scratch,'data/contributions.json'),JSON.stringify({schema_version:1,repositories:[{slug:'empty',contributions:[]}]}));
        f.build();
        assert.equal(fs.existsSync(path.join(f.output,'contributions')),false);
        assert.equal(f.read('projects/index.html').includes('Open Source Contributions'),false);
        return;
      }
      const archive = f.read('contributions/index.html');
      assert.equal((archive.match(/class="project-card contribution-card"/g)||[]).length,count);
      assert.equal(archive.includes('data-contribution-controls'),count >= 7);
      assert.ok(archive.indexOf(`fixture/repo-${count-1}`) <= archive.indexOf('fixture/repo-0'));
      const detail = f.read('contributions/fixture-repo-0/index.html');
      for (const text of ['Test description 0','Merged','2026-01-01','2026-02-01','https://github.com/fixture/repo-0/pull/10','/projects/portfolio/']) assert.ok(detail.includes(text),text);
      assert.ok(f.read('sitemap.xml').includes('/contributions/fixture-repo-0/'));
    } finally {f.clean();}
  });
}
test('production contribution dataset contains no synthetic entries',()=>{
  const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../data/contributions.json'),'utf8'));
  assert.equal(data.schema_version,1);
  assert.ok(data.repositories.every(repo=>!repo.repository.startsWith('fixture/')));
});

test('repository activity uses all PRs, falls back to date, and retains grouped history',()=>{
  const f=fixture(2);
  try {
    const repo=f.repositories[0];
    repo.contributions= ['open','merged','closed','draft'].map((status,i)=>({
      number:20+i,title:`History ${status}`,description:`Recorded ${status} work`,status,
      date:`2026-03-0${i+1}`,url:`https://github.com/fixture/repo-0/pull/${20+i}`,
    }));
    fs.writeFileSync(path.join(f.scratch,'data/contributions.json'),JSON.stringify({schema_version:1,repositories:f.repositories}));
    f.build();
    const archive=f.read('contributions/index.html');
    assert.ok(archive.indexOf('fixture/repo-0')<archive.indexOf('fixture/repo-1'));
    assert.ok(archive.includes('4 contributions'));
    assert.ok(archive.includes('2026-03-04'));
    const detail=f.read('contributions/fixture-repo-0/index.html');
    assert.ok(detail.indexOf('History draft')<detail.indexOf('History open'));
    for(const status of ['open','merged','closed','draft']) assert.ok(detail.includes(`Recorded ${status} work`));
    assert.ok(detail.includes('/projects/portfolio/'));
  } finally {f.clean();}
});
