const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const http = require('node:http');
const root = path.resolve(__dirname, '../..');
function fixture(count, {projectCount} = {}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-contributions-'));
  for (const name of ['layouts', 'content', 'static', 'data', 'hugo.toml']) fs.cpSync(path.join(root, name), path.join(scratch, name), {recursive:true});
  if (projectCount !== undefined) {
    const projects = path.join(scratch,'content/projects');
    const keep = ['portfolio','babsy'].slice(0,projectCount);
    for (const entry of fs.readdirSync(projects,{withFileTypes:true})) {
      if(entry.isDirectory() && !keep.includes(entry.name)) fs.rmSync(path.join(projects,entry.name),{recursive:true,force:true});
    }
    for(let i=3;i<=projectCount;i++) {
      const directory=path.join(projects,`fixture-project-${i}`);
      fs.mkdirSync(directory,{recursive:true});
      fs.writeFileSync(path.join(directory,'index.md'),`---\ntitle: Synthetic project ${i}\ndraft: false\nproject_type: Other\ncategory: Test fixture\ndescription: Scratch project for threshold checks.\nstatus: In development\ndevelopment_date: 2026-10-24\nupdated_date: 2026-10-24\n---\nTest content only.\n`);
    }
  }
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
async function serveFixture(count, options) {
  const f=fixture(count,options);
  const server=http.createServer((request,response)=>{
    const pathname=new URL(request.url,'http://localhost').pathname;
    let file=path.resolve(f.output,'.'+decodeURIComponent(pathname));
    if(!file.startsWith(f.output+path.sep)) return response.writeHead(403).end();
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
    if(!fs.existsSync(file)) return response.writeHead(404).end();
    const types={'.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.html':'text/html'};
    response.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {...f,url:`http://127.0.0.1:${server.address().port}`,close:async()=>{await new Promise(resolve=>server.close(resolve));f.clean();}};
}
module.exports = {fixture,serveFixture};
