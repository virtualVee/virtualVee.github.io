(() => {
  const controls = document.querySelector('[data-contribution-controls]');
  if (!controls) return;
  const grid = document.querySelector('#contribution-results');
  const cards = [...grid.children];
  const sort = document.querySelector('#contribution-sort');
  const category = document.querySelector('#contribution-category');
  const status = document.querySelector('[data-contribution-status]');
  const update = () => {
    const ordered = [...cards].sort((a, b) => {
      const x = a.dataset, y = b.dataset;
      if (sort.value === 'name') return x.contributionName.localeCompare(y.contributionName);
      const order = x.contributionActivity.localeCompare(y.contributionActivity);
      return (sort.value === 'oldest' ? order : -order) || x.contributionName.localeCompare(y.contributionName);
    });
    let count = 0;
    ordered.forEach(card => {
      card.hidden = Boolean(category.value && card.dataset.contributionCategory !== category.value);
      if (!card.hidden) count++;
      grid.append(card);
    });
    status.textContent = `${count} ${count === 1 ? 'repository' : 'repositories'}`;
  };
  sort.addEventListener('change', update);
  category.addEventListener('change', update);
  controls.hidden = false;
  status.hidden = false;
  update();
})();
