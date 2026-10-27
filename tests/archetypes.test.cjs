const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

test("new Hugo project contains shared metadata and stays draft until filled in", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-archetype-"));
  try {
    fs.mkdirSync(path.join(scratch,"archetypes"));
    fs.mkdirSync(path.join(scratch,"content"));
    fs.writeFileSync(path.join(scratch,"hugo.toml"), 'baseURL = "https://example.test/"\n');
    fs.copyFileSync(path.resolve(__dirname,"../archetypes/projects.md"),path.join(scratch,"archetypes/projects.md"));
    execFileSync("hugo",["new","content","projects/example/index.md","--source",scratch],{stdio:"pipe"});
    const content = fs.readFileSync(path.join(scratch,"content/projects/example/index.md"),"utf8");
    for (const field of ["title","project_type","category","description","role","tools","status","development_date","updated_date","finished_date","finish_label"]) {
      assert.match(content,new RegExp(`^${field}:`,"m"));
    }
    assert.match(content,/^draft: true$/m);
    assert.match(content,/^finished_date: ""$/m);
    assert.match(content,/^finish_label: "Initial release"$/m);
  } finally {
    fs.rmSync(scratch,{recursive:true,force:true});
  }
});
