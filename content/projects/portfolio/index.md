---
title: "Building this portfolio"
project_type: "Websites"
weight: 1
date: 2026-10-27
draft: false
category: "Web design & documentation"
description: "A Hugo portfolio combining clear content, responsive design and automated testing."
role: "Content, structure and implementation"
tools: [Hugo, Markdown, CSS, JavaScript, Node.js, Python, Playwright, GitHub Pages]
status: "Live · Actively maintained"
year: 2026
finished_date: 2026-10-27
finish_label: "Initial release"
updated_date: 2026-10-27
development_date: 2026-10-12
github: "https://github.com/virtualVee/virtualVee.github.io"
---

## The idea

This portfolio is a project in its own right: a place to bring together my work in technology, process improvement and problem-solving, and explain how each project develops.

## What I’ve worked on

- **Structure and clarity:** Organising the site around a simple Home, About and Projects structure, with concise summaries and room for more detail.
- **Design and accessibility:** Building custom Hugo templates with responsive layouts, local fonts, light and dark themes, keyboard focus styles and reduced-motion support.
- **Content and iteration:** Refining my professional introduction, adding a CV download and LinkedIn link, and turning development notes into readable project stories.

## Keeping the content focused

Each project starts with a short overview, key contributions and next steps, so visitors can understand the work without reading a development diary. The detailed logs stay behind the scenes as a record of decisions and progress.

## Checking changes

I’ve added automated regression tests for project search, combined filters, date sorting, empty states and Reset. A separate check builds the site and inspects internal links, assets, page metadata and the CV download. Browser tests also check the download filename and file content, links opening in new tabs, and responsive layouts at phone, tablet and desktop widths in both themes.

The checks run locally with one command and are configured to run in GitHub Actions before deployment. They complement manual phone, keyboard and theme checks; they do not replace a full accessibility review.

## Working with AI

I use AI assistance to explore wording and implement changes. I set the direction and review the local preview; automated build checks support that review, alongside usability testing still to come.

## Current state and future improvements

The portfolio is live, with project search, filtering, date sorting and automated checks before deployment. The initial build is complete, and I continue to maintain the site as my work develops.

The October 2026 release marks completion of this version of the portfolio, rather than the site’s first-ever publication. The automated checks have passed locally and in GitHub Actions.

Future updates will focus on project screenshots, new case studies and improvements informed by use. Further accessibility testing with real tasks and devices remains part of that work.
