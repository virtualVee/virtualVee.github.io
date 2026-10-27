# Adding a project

Create a draft using the shared Hugo archetype:

```sh
hugo new content projects/my-project/index.md
```

Fill in the title, summary (`description`), project type, category, role and tools. Record the actual start milestone in `development_date`, the latest substantive progress in `updated_date`, and a truthful `status`.

Every card uses the same shared layout: title, summary, type, status, start and last-update dates. The detail page also displays role, tools and resource links. Initial release/finish details appear in both places only when `finished_date` is set; never enter an estimated finish date as an actual release.

For an ongoing project, leave `finished_date` blank and use a status such as `In development`. For an initial release followed by maintenance, set `finished_date`, keep `finish_label: "Initial release"`, and use `Live · Actively maintained`. For other types of completion, change `finish_label` to `Finished` if more appropriate.

Dates use YYYY-MM-DD and render as month/year. For this portfolio, its initial release date refers to completion of the current build, not the first-ever publication of the domain.

Leave `draft: true` until the content is ready. Run `npm test` before publication; the site audit requires valid recorded start/update dates and a status for published project cards. Release dates remain optional. Publishing is a separate approved commit/push step.
