---
title: "Building this portfolio"
project_type: "Websites"
weight: 1
date: 2026-10-27
draft: false
category: "Web design & documentation"
description: "A Hugo portfolio combining clear content, responsive design and automated testing."
role: "Content, structure and implementation"
tools: [Hugo, Markdown, CSS, JavaScript, Formspree, Cloudflare Turnstile, Node.js, Playwright, GitHub Pages]
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
- **Content and iteration:** Refining my professional introduction, adding profile links and a contact form, and turning development notes into readable project stories.

## Keeping the content focused

Each project starts with a short overview, key contributions and next steps, so visitors can understand the work without reading a development diary. The detailed logs stay behind the scenes as a record of decisions and progress.

## Making contact straightforward

The contact form uses Formspree so the site can receive enquiries without displaying my email address. It includes a live character counter, validation, in-page submission feedback and retry support that preserves the message when submission cannot be confirmed.

Spam protection combines a hidden honeypot with Cloudflare Turnstile. Browser checks give immediate feedback, while Formspree handles server-side verification. The integration refreshes the security check after each submission attempt so retries use a fresh token.

## Showing more as the portfolio grows

Project cards follow last-updated order. Search, filters and date sorting appear once five projects are published, keeping the smaller listing focused on the work itself.

I also built contribution history grouped by repository, with links to individual pull requests. It stays hidden until genuine contributions are recorded. A manually triggered checker prepares proposed records for review before publication.

## Checking changes

Node.js tests cover project controls and contribution tooling. Playwright checks generated pages, links, metadata, contact validation, character counting, CAPTCHA expiry and retry behaviour, and responsive layouts at phone, tablet and desktop widths in both themes. Tests run locally and in GitHub Actions before deployment. Automated contact tests simulate security challenges and intercept submissions, so they do not send real messages.

I use these checks alongside manual phone, keyboard and theme reviews. Further accessibility testing remains part of the ongoing work.

## Working with AI

I use AI assistance to explore wording and implement changes. I set the direction and review the local preview; automated checks and manual testing support that review.

## Current state and future improvements

The portfolio is live, with a protected contact form and automated checks before deployment. Project discovery controls and contribution history appear as the content grows. The initial build is complete, and I continue to maintain the site as my work develops.

The October 2026 release marks completion of this version of the portfolio, rather than the site’s first-ever publication. The automated checks have passed locally and in GitHub Actions.

Future updates will focus on project screenshots, new case studies and improvements informed by use. Further accessibility testing with real tasks and devices remains part of that work.
