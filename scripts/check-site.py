#!/usr/bin/env python3
"""Build Hugo in scratch storage and audit the generated site using only stdlib."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
import os
import re
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = set()
        self.duplicate_ids = set()
        self.references = []
        self.elements = []
        self.h1 = 0
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if "id" in attrs:
            if attrs["id"] in self.ids:
                self.duplicate_ids.add(attrs["id"])
            self.ids.add(attrs["id"])
        if tag == "h1":
            self.h1 += 1
        for attribute in ("href", "src"):
            if attrs.get(attribute):
                self.references.append(attrs[attribute])

    def find(self, tag, **attrs):
        return [a for t, a in self.elements if t == tag and all(a.get(k) == v for k, v in attrs.items())]


def audit(site):
    site = site.resolve()
    errors = []
    texts = {path: path.read_text() for path in site.rglob("*.html")}
    pages = {path: Page(text) for path, text in texts.items()}
    def require(condition, message):
        if not condition:
            errors.append(message)

    for path, page in pages.items():
        name = str(path.relative_to(site))
        # Hugo aliases are redirects rather than content pages.
        if page.find("meta", **{"http-equiv": "refresh"}):
            continue
        require(page.h1 == 1, name + ": expected one main heading")
        require(not page.duplicate_ids, name + ": duplicate IDs " + str(page.duplicate_ids))
        require(any(a.get("lang") for a in page.find("html")), name + ": missing page language")
        require(any(a.get("content", "").strip() for a in page.find("meta", name="description")), name + ": missing description")
        canonicals = page.find("link", rel="canonical")
        require(len(canonicals) == 1 and canonicals[0].get("href", "").startswith("https://vanessacorreia.com/"), name + ": incorrect production canonical")
        require(not any(token in texts[path] for token in ("[YOUR", "[Project 0", "under restructuring", "https://example.com")), name + ": placeholder content leaked")
        for ref in page.references:
            url = urlsplit(ref)
            if url.scheme not in ("", "http", "https"):
                continue
            if url.netloc and url.netloc != "vanessacorreia.com":
                continue  # External availability is deliberately outside this offline check.
            if not url.path:
                target = path
            elif url.path.startswith("/"):
                target = site / unquote(url.path).lstrip("/")
            else:
                target = path.parent / unquote(url.path)
            target = target.resolve()
            if target.is_dir():
                target = target / "index.html"
            require(target.is_relative_to(site), name + ": local link escapes site root: " + ref)
            require(target.is_file(), name + ": missing internal target " + ref)
            if url.fragment and target in pages:
                require(unquote(url.fragment) in pages[target].ids, name + ": missing fragment " + ref)
        for tag, attrs in page.elements:
            if tag == "a" and attrs.get("target") == "_blank":
                require("noopener" in attrs.get("rel", "").split(), name + ": new-tab link missing noopener")

    for route in ("index.html", "about/index.html", "projects/index.html"):
        require(site.joinpath(route) in pages, "Missing main page: " + route)
    about = pages.get(site / "about/index.html")
    if about:
        downloads = [a for a in about.find("a") if "download" in a]
        require(bool(downloads), "About: missing CV download")
        for link in downloads:
            require(link.get("download") == "CORREIA, Vanessa_CV.pdf", "About: wrong CV download filename")
            pdf = site / urlsplit(link["href"]).path.lstrip("/")
            require(pdf.is_file() and pdf.read_bytes().startswith(b"%PDF-"), "About: missing/invalid PDF asset")
    projects = pages.get(site / "projects/index.html")
    if projects:
        require(any("data-project-placeholder" in a for _, a in projects.elements), "Projects: missing empty-view placeholder")
        require(any("data-project-filters" in a and "hidden" in a for _, a in projects.elements), "Projects: filters must be hidden until JS is ready")
        for control_id in ("project-search", "project-sort"):
            require(bool(projects.find("label", **{"for": control_id})), "Projects: missing label for " + control_id)
        options = {a.get("value") for a in projects.find("option")}
        require({"started-newest", "started-oldest", "finished-newest", "finished-oldest", "updated-newest"}.issubset(options), "Projects: missing date sort options")
        require(any(a.get("role") == "status" for _, a in projects.elements), "Projects: missing live result count")
    for source in (ROOT / "content/projects").glob("*/index.md"):
        if re.search(r"^draft:\s*true\s*$", source.read_text(), re.M):
            require(not (site / "projects" / source.parent.name / "index.html").exists(), "Draft published: " + source.parent.name)
    if errors:
        raise SystemExit("Site checks failed:\n- " + "\n- ".join(errors))
    print("Site checks passed: {} HTML pages; internal links/assets, metadata, drafts, CV and project controls.".format(len(pages)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", type=Path, help="Check an existing production build instead of building in scratch storage")
    args = parser.parse_args()
    if args.site:
        audit(args.site.resolve())
        return
    with tempfile.TemporaryDirectory(prefix="portfolio-test-") as scratch:
        scratch = Path(scratch)
        env = os.environ.copy()
        env["HUGO_RESOURCEDIR"] = str(scratch / "resources")
        subprocess.run(["hugo", "--gc", "--minify", "--environment", "production", "--noBuildLock", "--destination", str(scratch / "public"), "--cacheDir", str(scratch / "cache")], cwd=ROOT, env=env, check=True)
        audit(scratch / "public")

if __name__ == "__main__":
    main()
