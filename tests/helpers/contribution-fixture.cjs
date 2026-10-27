const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
function fixture(count) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-contributions-'));
  for (const name of ['layouts', 'content', 'static', 'data', 'hugo.toml']) fs.cpSync(path.join(root, name), path.join(scratch, name), {recursive:true});
  const draft = path.join(scratch, 'content/projects/fixture-draft');
  fs.mkdirSync(draft,{recursive:true});
  fs.writeFileSync(path.join(draft,'index.md'),'---\ntitle: Synthetic unpublished project\ndraft: true\n---\nNot public.\n');
  const repositories = Array.from({length:count}, (_, i) => ({
    slug:`fixture-repo-${i}`, repository:`fixture/repo-${i}`, url:`https://github.com/fixture/repo-${i}`,
    description:`Synthetic test repository ${i}`, category:i % 2 ? 'Documentation' : 'Code',
    ...(i === 0 ? {case_study:'/projects/portfolio'} : {}),
    contributions:[{number:10+i, title:`Synthetic contribution ${i}`, description:`Test description ${i}`,
      date:'2026-01-01', updated_at:`2026-02-${String(i+1).padStart(2,'0')}`, status:i % 2 ? 'open' : 'merged',
      url:`https://github.com/fixture/repo-${i}/pull/${10+i}`}],
  }));
  fs.writeFileSync(path.join(scratch, 'data/contributions.json'), JSON.stringify({schema_version:1,repositories}));
  const output = path.join(scratch, 'public');
  function build() {
    execFileSync('hugo',['--source',scratch,'--minify','--environment','production','--noBuildLock','--destination',output,'--cacheDir',path.join(scratch,'cache')],{env:{...process.env,HUGO_RESOURCEDIR:path.join(scratch,'resources')},stdio:'pipe'});
  }
  try {build();} catch(error) {fs.rmSync(scratch,{recursive:true,force:true});throw error;}
  return {scratch,output,repositories,build,read: route => fs.readFileSync(path.join(output,route),'utf8'),clean:()=>fs.rmSync(scratch,{recursive:true,force:true})};
}
module.exports = {fixture};
