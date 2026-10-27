const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise the shipped script with a minimal DOM adapter, without copying its logic.
const source = fs.readFileSync(path.join(__dirname, "../static/js/project-filters.js"), "utf8");
function element(dataset = {}) {
  return {
    dataset, hidden: false, value: "", textContent: "", attributes: {}, listeners: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
    fire(name) { this.listeners[name](); },
  };
}
function setup(records = [
  { name: "portfolio", type: "websites", text: "Portfolio Hugo documentation", start: "2026-10-12", updated: "2026-10-27" },
  { name: "babsy", type: "apps", text: "Babsy baby routines Expo", start: "2026-09-24", updated: "2026-10-23" },
]) {
  const cards = records.map(record => {
    const card = element({ projectType: record.type, projectSearch: record.text, projectUpdated: record.updated || "", projectStarted: record.start || "", projectFinished: record.finish || "" });
    card.name = record.name;
    card.number = element();
    card.querySelector = () => card.number;
    return card;
  });
  const buttons = ["all", "apps", "websites"].map(projectFilter => element({ projectFilter }));
  const filters = element(); filters.querySelectorAll = () => buttons;
  const grid = element(); grid.children = [...cards];
  const placeholder = element();
  grid.querySelectorAll = () => cards;
  grid.querySelector = () => placeholder;
  grid.append = card => { grid.children = grid.children.filter(c => c !== card); grid.children.push(card); };
  const search = element(); const sort = element(); sort.value = "updated-newest";
  const reset = element(); const status = element(); const empty = element(); const controls = element();
  const selectors = { "[data-project-filters]": filters, "#project-results": grid, "[data-project-filter-status]": status, "[data-project-search-sort]": controls, "#project-search": search, "#project-sort": sort, "[data-project-reset]": reset, "[data-project-empty]": empty };
  vm.runInNewContext(source, { document: { querySelector: selector => selectors[selector] } });
  return {
    cards, buttons, placeholder, status, empty, search, sort,
    shown: () => grid.children.filter(c => cards.includes(c) && !c.hidden).map(c => c.name),
    query(value) { search.value = value; search.fire("input"); },
    type(value) { buttons.find(b => b.dataset.projectFilter === value).fire("click"); },
    order(value) { sort.value = value; sort.fire("change"); },
    reset() { reset.fire("click"); },
  };
}

test("initial view shows most recently updated projects first and announces the count", () => {
  const ui = setup([
    {name:"older-start",type:"websites",text:"Older start",start:"2026-01-01",updated:"2026-10-27"},
    {name:"newer-start",type:"apps",text:"Newer start",start:"2026-10-01",updated:"2026-10-02"},
  ]);
  assert.deepEqual(ui.shown(), ["older-start", "newer-start"]);
  assert.equal(ui.status.textContent, "Showing 2 of 2 projects");
  assert.equal(ui.placeholder.hidden, true);
  assert.equal(ui.buttons[0].attributes["aria-pressed"], "true");
});
test("search ignores case and extra spaces and combines all words", () => {
  const ui = setup(); ui.query("  BABY   ROUTINES  ");
  assert.deepEqual(ui.shown(), ["babsy"]);
  ui.query("BABY HUGO"); assert.deepEqual(ui.shown(), []);
});
test("search treats accents equivalently and punctuation as literal text", () => {
  const ui = setup([{ name: "cv", type: "websites", text: "Résumé C++", start: "2026-01-01" }]);
  ui.query("resume c++"); assert.deepEqual(ui.shown(), ["cv"]);
  ui.query(".*"); assert.deepEqual(ui.shown(), []);
});
test("type and search combine; hidden projects are removed from results", () => {
  const ui = setup(); ui.query("expo"); ui.type("websites");
  assert.deepEqual(ui.shown(), []);
  assert.equal(ui.placeholder.hidden, false);
  assert.equal(ui.empty.hidden, false);
  ui.type("apps"); assert.deepEqual(ui.shown(), ["babsy"]);
  assert.equal(ui.placeholder.hidden, true);
});
test("start dates sort both ways and omit projects with no recorded start", () => {
  const ui = setup([
    {name:"later", type:"apps", text:"Later", start:"2026-10-01"},
    {name:"undated", type:"apps", text:"Undated"},
    {name:"earlier", type:"apps", text:"Earlier", start:"2026-01-01"},
  ]);
  ui.order("started-newest");
  assert.deepEqual(ui.shown(), ["later", "earlier"]);
  ui.order("started-oldest"); assert.deepEqual(ui.shown(), ["earlier", "later"]);
});
test("finish dates sort both ways and exclude unfinished projects", () => {
  const ui = setup([
    {name:"ongoing",type:"apps",text:"Ongoing",start:"2026-10-01"},
    {name:"recent",type:"apps",text:"Recent",start:"2026-01-01",finish:"2026-10-20"},
    {name:"earlier",type:"websites",text:"Earlier",start:"2026-02-01",finish:"2026-09-15"},
  ]);
  ui.order("finished-newest"); assert.deepEqual(ui.shown(), ["recent", "earlier"]);
  ui.order("finished-oldest"); assert.deepEqual(ui.shown(), ["earlier", "recent"]);
});
test("empty start/finish views show the future-project placeholder", () => {
  const ui = setup(); ui.order("finished-newest");
  assert.deepEqual(ui.shown(), []); assert.equal(ui.placeholder.hidden, false);
  const noDates = setup([{name:"undated",type:"apps",text:"Undated"}]);
  noDates.order("started-newest");
  assert.deepEqual(noDates.shown(), []); assert.equal(noDates.placeholder.hidden, false);
  const none = setup([]); assert.equal(none.placeholder.hidden, false);
});
test("equal dates keep a stable order", () => {
  const ui = setup(["first", "second"].map(name => ({name,type:"apps",text:name,start:"2026-01-01"})));
  ui.order("started-oldest"); assert.deepEqual(ui.shown(), ["first", "second"]);
  ui.order("started-newest"); assert.deepEqual(ui.shown(), ["first", "second"]);
});
test("reset clears search, type and date mode and restores projects", () => {
  const ui = setup(); ui.query("missing"); ui.type("apps"); ui.order("finished-oldest"); ui.reset();
  assert.deepEqual(ui.shown(), ["portfolio", "babsy"]);
  assert.equal(ui.placeholder.hidden, true);
  assert.equal(ui.search.value, ""); assert.equal(ui.sort.value, "updated-newest");
  assert.equal(ui.empty.hidden, true);
  assert.equal(ui.buttons[0].attributes["aria-pressed"], "true");
});
test("script safely ignores pages without project controls", () => {
  assert.doesNotThrow(() => vm.runInNewContext(source, {document:{querySelector:() => null}}));
});

test("latest updated uses update dates rather than start dates and keeps undated projects last", () => {
  const ui = setup([
    {name:"new-start",type:"apps",text:"New start",start:"2026-10-20",updated:"2026-10-21"},
    {name:"recent-update",type:"websites",text:"Recent update",start:"2026-01-01",updated:"2026-10-27"},
    {name:"no-update",type:"apps",text:"No update",start:"2026-10-25"},
  ]);
  ui.order("updated-newest");
  assert.deepEqual(ui.shown(), ["recent-update", "new-start", "no-update"]);
  ui.query("update"); ui.type("apps");
  assert.deepEqual(ui.shown(), ["no-update"]);
});
