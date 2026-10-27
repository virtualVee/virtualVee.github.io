(() => {
  const filters = document.querySelector("[data-project-filters]");
  const grid = document.querySelector("#project-results");
  const status = document.querySelector("[data-project-filter-status]");
  const controls = document.querySelector("[data-project-search-sort]");
  const search = document.querySelector("#project-search");
  const sort = document.querySelector("#project-sort");
  const reset = document.querySelector("[data-project-reset]");
  const empty = document.querySelector("[data-project-empty]");
  if (!filters || !grid || !status || !controls || !search || !sort || !reset || !empty) return;

  const buttons = [...filters.querySelectorAll("[data-project-filter]")];
  const cards = [...grid.querySelectorAll("[data-project-type]")];
  const placeholder = grid.querySelector("[data-project-placeholder]");
  const normalize = (text) => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const entries = cards.map((card, index) => ({
    card,
    index,
    text: normalize(card.dataset.projectSearch || ""),
    updated: Date.parse(card.dataset.projectUpdated),
    started: Date.parse(card.dataset.projectStarted),
    finished: Date.parse(card.dataset.projectFinished),
  }));
  let selectedType = "all";

  function update() {
    const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    const [dateField, direction] = sort.value.split("-");
    const ordered = [...entries].sort((a, b) => {
      const aDate = a[dateField];
      const bDate = b[dateField];
      if (!Number.isFinite(aDate)) return Number.isFinite(bDate) ? 1 : a.index - b.index;
      if (!Number.isFinite(bDate)) return -1;
      return (direction === "oldest" ? aDate - bDate : bDate - aDate) || a.index - b.index;
    });
    let visible = 0;
    ordered.forEach((entry, index) => {
      const { card, text } = entry;
      card.hidden = (dateField !== "updated" && !Number.isFinite(entry[dateField])) || (selectedType !== "all" && card.dataset.projectType !== selectedType)
        || !terms.every((term) => text.includes(term));
      if (!card.hidden) visible += 1;
      const number = card.querySelector(".project-number");
      if (number) number.textContent = String(index + 1).padStart(2, "0");
      grid.append(card);
    });
    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.projectFilter === selectedType));
    });
    const filtered = selectedType !== "all" || terms.length > 0;
    if (placeholder) {
      placeholder.hidden = visible > 0;
      grid.append(placeholder);
    }
    grid.dataset.filtered = String(filtered || visible === 0);
    status.textContent = `Showing ${visible} of ${cards.length} ${cards.length === 1 ? "project" : "projects"}`;
    empty.hidden = visible !== 0 || (terms.length === 0 && selectedType === "all");
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedType = button.dataset.projectFilter;
      update();
    });
  });
  search.addEventListener("input", update);
  sort.addEventListener("change", update);
  reset.addEventListener("click", () => {
    search.value = "";
    sort.value = "updated-newest";
    selectedType = "all";
    update();
  });
  update();
  filters.hidden = false;
  controls.hidden = false;
  status.hidden = false;
})();
