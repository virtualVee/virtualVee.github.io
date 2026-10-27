const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
let scratch, site;

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
async function parse(page, html) {
  await page.setContent(html, {waitUntil:"domcontentloaded"});
  return page.evaluate(() => ({
    h1: document.querySelectorAll("h1").length,
    elements: [...document.querySelectorAll("*")].map(el => ({
      tag:el.localName,
      attrs:Object.fromEntries([...el.attributes].map(a => [a.name,a.value])),
    })),
  }));
}
function find(facts, tag, attrs = {}) {
  return facts.elements.filter(el => el.tag === tag && Object.entries(attrs).every(([key,value]) => el.attrs[key] === value)).map(el => el.attrs);
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0,10) === value;
}
function audit(pages) {
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  for (const [file, {facts, html}] of pages) {
    const name = path.relative(site,file).split(path.sep).join("/");
    if (find(facts,"meta").some(a => (a["http-equiv"] || "").toLowerCase() === "refresh")) continue;
    require(facts.h1 === 1, `${name}: expected one main heading`);
    const ids = facts.elements.filter(e => "id" in e.attrs).map(e => e.attrs.id);
    require(new Set(ids).size === ids.length, `${name}: duplicate IDs`);
    require(find(facts,"html").some(a => a.lang?.trim()), `${name}: missing page language`);
    require(find(facts,"meta",{name:"description"}).some(a => a.content?.trim()), `${name}: missing description`);
    const canonical = find(facts,"link",{rel:"canonical"});
    require(canonical.length === 1 && canonical[0].href?.startsWith("https://vanessacorreia.com/"), `${name}: incorrect production canonical`);
    require(!["[YOUR","[Project 0","under restructuring","https://example.com"].some(token => html.includes(token)), `${name}: placeholder content leaked`);
    for (const {tag,attrs} of facts.elements) {
      if (tag === "a" && attrs.target === "_blank") require((attrs.rel || "").split(/\s+/).includes("noopener"), `${name}: new-tab link missing noopener`);
      for (const key of ["href","src"]) {
        if (!attrs[key]) continue;
        let url;
        try { url = new URL(attrs[key], "https://vanessacorreia.com/" + name); }
        catch { errors.push(`${name}: invalid URL ${attrs[key]}`); continue; }
        if (!["http:","https:"].includes(url.protocol) || url.host !== "vanessacorreia.com") continue;
        let target = path.resolve(site,"." + decodeURIComponent(url.pathname));
        const relative = path.relative(site,target);
        const inside = relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
        require(inside, `${name}: local link escapes site root: ${attrs[key]}`);
        if (!inside) continue;
        if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target,"index.html");
        require(fs.existsSync(target) && fs.statSync(target).isFile(), `${name}: missing internal target ${attrs[key]}`);
        if (url.hash && pages.has(target)) {
          const targetIds = pages.get(target).facts.elements.map(e => e.attrs.id);
          require(targetIds.includes(decodeURIComponent(url.hash.slice(1))), `${name}: missing fragment ${attrs[key]}`);
        }
      }
    }
  }
  for (const route of ["index.html","about/index.html","projects/index.html"]) require(pages.has(path.join(site,route)), `Missing main page: ${route}`);
  const about = pages.get(path.join(site,"about/index.html"))?.facts;
  if (about) {
    require(!find(about,"a").some(a => "download" in a), "About: CV download must not be published");
    require(!find(about,"a").some(a => a.href?.startsWith("mailto:")), "About: direct email must not be published");
    require(!fs.existsSync(path.join(site,"downloads/vanessa-correia-cv.pdf")), "Private CV must not be in published output");
    require(about.elements.some(e => e.attrs.id === "contact"), "About: missing contact section");
    for (const id of ["contact-name","contact-email","contact-message"]) require(find(about,"label",{for:id}).length > 0, `About: missing form label ${id}`);
  }
  const projects = pages.get(path.join(site,"projects/index.html"))?.facts;
  if (projects) {
    require(projects.elements.some(e => "data-project-placeholder" in e.attrs), "Projects: missing empty-view placeholder");
    const cardCount = find(projects,"a").filter(a => "data-project-type" in a).length;
    if (cardCount >= 5) {
      require(projects.elements.some(e => "data-project-filters" in e.attrs && "hidden" in e.attrs), "Projects: filters must be hidden until JS is ready");
      for (const id of ["project-search","project-sort"]) require(find(projects,"label",{for:id}).length > 0, `Projects: missing label for ${id}`);
      require(find(projects,"option").some(a => a.value === "updated-newest" && "selected" in a), "Projects: Last updated must be the default sort");
      const options = new Set(find(projects,"option").map(a => a.value));
      require(["started-newest","started-oldest","finished-newest","finished-oldest","updated-newest"].every(value => options.has(value)), "Projects: missing date sort options");
      require(projects.elements.some(e => e.attrs.role === "status"), "Projects: missing live result count");
    } else {
      require(!projects.elements.some(e => ["project-search","project-sort"].includes(e.attrs.id) || "data-project-filters" in e.attrs), "Projects: lookup controls exposed below five published projects");
    }
    for (const attrs of find(projects,"a").filter(a => "data-project-type" in a)) {
      require(Boolean(attrs["data-project-status"]?.trim()), `${attrs.href}: missing project status`);
      for (const field of ["started","updated"]) require(validDate(attrs["data-project-"+field]), `${attrs.href}: missing/invalid ${field} date`);
    }

  }
  for (const entry of fs.readdirSync(path.join(root,"content/projects"),{withFileTypes:true}).filter(e => e.isDirectory())) {
    const source = path.join(root,"content/projects",entry.name,"index.md");
    if (fs.existsSync(source) && /^draft:\s*true\s*$/m.test(fs.readFileSync(source,"utf8"))) require(!fs.existsSync(path.join(site,"projects",entry.name,"index.html")), `Draft published: ${entry.name}`);
  }
  return errors;
}
async function readPages(page) {
  // Use the browser's HTML parser, without executing scripts or contacting external services.
  await page.route("**/*", route => route.abort());
  const pages = new Map();
  for (const file of walk(site).filter(file => file.endsWith(".html"))) {
    const html = fs.readFileSync(file,"utf8");
    pages.set(file,{html,facts:await parse(page,html)});
  }
  return pages;
}

test.beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(),"portfolio-site-audit-"));
  site = fs.realpathSync(scratch) + path.sep + "public";
  execFileSync("hugo",["--gc","--minify","--environment","production","--noBuildLock","--destination",site,"--cacheDir",path.join(scratch,"cache")],{
    cwd:root,env:{...process.env,HUGO_RESOURCEDIR:path.join(scratch,"resources")},stdio:"pipe",
  });
});
test.afterAll(() => { if (scratch) fs.rmSync(scratch,{recursive:true,force:true}); });

test("generated production pages preserve links, metadata, privacy and project conventions", async ({page}) => {
  const pages = await readPages(page);
  expect(pages.size).toBeGreaterThan(0);
  expect(audit(pages)).toEqual([]);
});

test("site audit rejects missing assets, broken fragments, duplicate IDs and exposed contact details", async ({page}) => {
  const pages = await readPages(page);
  const file = path.join(site,"about/index.html");
  const original = pages.get(file).html;
  const broken = original.replace("</body>", '<a href="/missing-test-asset.png">Broken asset</a><a href="#missing-test-fragment">Broken fragment</a><span id="contact"></span><a href="mailto:test@example.com">Email</a><a download href="/downloads/vanessa-correia-cv.pdf">CV</a></body>');
  pages.set(file,{html:broken,facts:await parse(page,broken)});
  const pdf = path.join(site,"downloads/vanessa-correia-cv.pdf");
  fs.mkdirSync(path.dirname(pdf),{recursive:true});
  fs.writeFileSync(pdf,"%PDF-synthetic regression fixture");
  try {
    const errors = audit(pages);
    for (const expected of ["missing internal target","missing fragment","duplicate IDs","CV download must not","direct email must not","Private CV must not"]) expect(errors.some(error => error.includes(expected)),expected).toBe(true);
  } finally { fs.unlinkSync(pdf); }
});
