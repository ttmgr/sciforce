#!/usr/bin/env python3
"""Generate HUB.html — auto-derived + curated project dashboard.

A *narrative* layer for the repo: project status, where current truth lives,
the temporal waves of work, the named concepts, the runnable scripts, who's
contributed, what's loose right now (uncommitted / unpushed / TODOs / drafts).
Distinct from INDEX.html (structural file graph) — HUB.html answers "what's
the state of this project?", INDEX.html answers "where in the code is X?".

The generator pulls from FOUR sources, in increasing curation:

1.  git state                         — status pill, waves, contributors, activity, loose-ends
2.  filesystem + README/CONTEXT/CLAUDE.md — auto-derived canonical, concepts, scripts
3.  docs/hub.yaml (optional)           — surgical overrides (`oneliner:`, `next_action:`, ...)
4.  HUB.md / docs/HUB.md (optional)    — curated `## :section` bodies, win over auto-derive

Designed to be **project-agnostic** so it runs unchanged in any repo. Heuristics
fill in for everything; overrides are only needed when auto-derive gets it wrong.

Usage:
    python3 scripts/build_hub.py              # write HUB.html
    python3 scripts/build_hub.py --check      # exit 1 if stale
    python3 scripts/build_hub.py --out PATH   # explicit output path
    python3 scripts/build_hub.py --brief      # print compact agent brief to stdout
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml  # used only if docs/hub.yaml present
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

ROOT = Path(__file__).resolve().parent.parent
OVERRIDES = ROOT / "docs" / "hub.yaml"
README = ROOT / "README.md"
CONTEXT = ROOT / "CONTEXT.md"
CLAUDE_MD = ROOT / "CLAUDE.md"
INDEX_HTML_DOCS = ROOT / "docs" / "INDEX.html"
INDEX_HTML_ROOT = ROOT / "INDEX.html"
ADR_DIR = ROOT / "docs" / "adr"
PLANS_DIR = ROOT / "docs" / "plans"
SCRIPTS_DIR = ROOT / "scripts"
LEARNINGS = ROOT / "LEARNINGS.md"

# Bump on every change to the skill master. Installed copies compare their own
# value against the master's so --brief can say "your copy is out of date"; a
# local patch in a repo copy leaves this line alone, so it does not trigger.
HUB_VERSION = "2026-10-20"
SKILL_MASTER = Path.home() / ".claude" / "skills" / "79-project-hub" / "scripts" / "build_hub.py"

# Earth+Sky palette — Tim's design tokens.
PALETTE = {
    "air":      "#2471A3",
    "water":    "#1F8A70",
    "thesis":   "#B5651D",
    "ink":      "#1A1A1A",
    "muted":    "#6B6B6B",
    "bg":       "#FFFFFF",
    "bg_soft":  "#F4F4F2",
    "border":   "#E5E5E5",
    "border_2": "#D5D5D5",
    "ok":       "#2D8659",
    "warn":     "#B5651D",
    "fail":     "#A6402A",
    "dim":      "#B0B0B0",
    "accent":   "#C0392B",   # NEXT-action line — pops against the lo-fi palette
}

CHECKPOINT_CANDIDATES = ["CHECKPOINT.md", "SESSION.md", "HANDOVER.md"]
CURATED_CANDIDATES = ["HUB.md", "docs/HUB.md", "docs/hub.md"]
DRAFT_PATTERNS = ("draft", "wip", "_v_", "scratch")
TODO_RE = re.compile(r"\b(TODO|FIXME|XXX|HACK)\b", re.IGNORECASE)
TODO_SKIP_EXTS = ("csv", "tsv", "json", "jsonl", "ipynb", "html", "svg",
                  "lock", "map", "min.js")

# Plain-English subtitle for each section, rendered after the `///:section_name`
# heading. 2–4 sentences each. Designed for a reader who has never seen this
# dashboard before and is reading it at 2 a.m.
SECTION_BLURBS = {
    "status": "A one-glance verdict on whether this project is alive, paused, or shelved. Pulled from a curated status line where possible, otherwise inferred from how recent the last commit is (a repo that hasn't moved in six months gets flagged DORMANT). Read this first to decide if it's even worth digging in.",
    "pickup": "Where the last working session ended, lifted verbatim from the most recent handover note (CHECKPOINT.md, SESSION.md, or HANDOVER.md). Think of it as a sticky note from past-you to present-you — usually the fastest way back into the work without re-reading everything.",
    "loose_ends": "Everything that's mid-air right now in your local working copy and git history. Uncommitted edits, commits sitting locally that nobody else can see yet, TODO and FIXME notes scattered in the code, and any files with 'draft' or 'wip' in the name. If you want to leave a clean slate before stepping away, this is the to-do list.",
    "waves": "A horizontal timeline of the phases this project has moved through, with each circle sized by how busy that phase was. Useful for spotting whether you're in a flurry of work or a quiet stretch, and for remembering what big chunks of effort came before (e.g. an early 'data ingestion' phase, then a later 'paper writing' phase). The newest phase is highlighted.",
    "map": "A directory-level overview of the repo, one tile per top-level folder. Tiles are colour-coded by what's mostly inside (code, docs, data, figures) and show file counts plus when the folder was last touched, newest first. Good for getting the lay of the land in three seconds.",
    "graph": "A draggable bubble diagram of the same top-level folders, with lines drawn between folders that depend on each other — for example, a scripts folder linked to the outputs folder it writes into. Useful for spotting which parts of the repo are tightly coupled and which sit on their own. Scroll to zoom, click a circle to focus on what it touches.",
    "canonical": "The official source-of-truth files for this project. If anything else in the repo disagrees with these, these win — everything not listed here is historical, draft, or auxiliary and can be ignored. Each card shows the file's age and warns if it's gone missing from disk.",
    "concepts": "A small glossary of project-specific terms that keep showing up in commits, memos, and code (things like 'dual_threshold' or 'competitive_mapping'). Each entry pairs the term with a short definition so you don't have to reverse-engineer the meaning from context months down the line.",
    "scripts": "The runnable entry points of the repo — Python scripts, npm tasks, Makefile targets — each one paired with what it produces. Treat this as the 'how does anything in here get made' index. If you want to know which command regenerates a given figure or table, start here.",
    "decisions": "Architecture Decision Records (ADRs) — one short Markdown file per past design call, kept under docs/adr/. They explain WHY the code looks the way it does, so future-you doesn't undo a deliberate choice by accident. Worth a skim before any refactor that feels obvious.",
    "plans": "Implementation plans that are mid-flight, one Markdown file each under docs/plans/. Each plan is a task-by-task breakdown for a feature still being built, with the boxes that are done and the ones still open. Open one to see what's next on the build list.",
    "collaborators": "Everyone who has touched this repo via git, plus anyone explicitly credited in the curated list. Handy when you need to track down who originally wrote a chunk of code or owns a particular module and your memory is blank.",
    "activity": "The last eight commits to the repo, newest first, with the author and how long ago each one landed. A quick pulse-check on what's moved recently — useful for catching changes someone else made while you were away.",
    "superseded": "Folders kept around purely for historical reference — old versions, backups, archived runs (anything matching patterns like _old, _v2, *backup*, or *.archived-*). Dimmed on purpose so it doesn't compete for attention; only dig in here if you specifically need to look at how something used to be.",
    "guardrails": "The safety nets that stop accidents — pre-commit hooks, CI workflows, check-/verify-/lint- scripts, policy tests, secret-scan configs, ops runbooks, and the NEVER/ALWAYS rulebook in CLAUDE.md. Each card shows the file the check lives in and when it runs. If one of these fails, fix the underlying problem; don't bypass the check with --no-verify or by deleting the test.",
}

# Plain-English titles shown to readers (newcomer-friendly, no `:tag` cipher).
SECTION_LABELS = {
    "status":        "Status",
    "guardrails":    "Guardrails",
    "pickup":        "Where we left off",
    "loose_ends":    "Loose ends",
    "waves":         "Phases of work",
    "map":           "Folder map",
    "graph":         "Code map",
    "canonical":     "Important files",
    "concepts":      "Glossary",
    "scripts":       "Scripts you can run",
    "decisions":     "Decisions",
    "plans":         "Plans",
    "collaborators": "People",
    "activity":      "Recent activity",
    "superseded":    "Archived",
}


def section_heading(key: str, extra_hint: str = "") -> str:
    """Plain-English `<h2>` + a one-paragraph `.hint` subtitle."""
    title = (str(key).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             if key not in SECTION_LABELS
             else SECTION_LABELS[key])
    blurb = SECTION_BLURBS.get(key, "")
    blurb_html = (blurb.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                  .replace('"', "&quot;"))
    if extra_hint:
        blurb_html = f"{blurb_html} {extra_hint}"
    return (f'    <h2 class="section">{title}</h2>\n'
            f'    <p class="hint">{blurb_html}</p>')


# --- generic helpers ------------------------------------------------------

def git(*args: str, default: str = "") -> str:
    try:
        return subprocess.check_output(
            ["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL,
        ).strip()
    except subprocess.CalledProcessError:
        return default


def git_raw(*args: str, default: str = "") -> str:
    """Same as git() but does NOT strip the output. Use when column positions
    matter — `git status --porcelain` lines start with " M …" and a global strip
    would eat the leading space from the first line, mis-aligning everything."""
    try:
        return subprocess.check_output(
            ["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return default


def git_subdir_prefix() -> str:
    """If ROOT is inside (but not equal to) the git toplevel, return the
    relative subdir prefix (e.g. "foodsafety/"). Empty if ROOT is the toplevel.
    Used to strip the prefix from `git status` paths so vscode_link doesn't
    double it."""
    toplevel = git("rev-parse", "--show-toplevel")
    if not toplevel:
        return ""
    try:
        top = Path(toplevel).resolve()
        if top == ROOT:
            return ""
        rel = ROOT.relative_to(top).as_posix()
        return "" if rel in {"", "."} else rel + "/"
    except (ValueError, OSError):
        return ""


_REPO_FILES: list[Path] | None = None


def repo_files() -> list[Path]:
    """Every file git knows about (tracked + untracked-but-not-ignored), as
    absolute Paths under ROOT. One git call instead of an rglob over the whole
    working tree — gitignored bulk (node_modules, dist, venvs, exports…) never
    enters the walk, which is what keeps --brief fast enough to run inside a
    session-start hook. Falls back to a pruned os.walk outside a git repo."""
    global _REPO_FILES
    if _REPO_FILES is not None:
        return _REPO_FILES
    raw = git_raw("ls-files", "-z", "--cached", "--others", "--exclude-standard")
    if raw:
        _REPO_FILES = [ROOT / r for r in raw.split("\0") if r]
    else:
        skip = {".git", "node_modules", "DerivedData", "__pycache__",
                ".matplotlib-cache", ".venv", "venv", ".pytest_cache",
                ".mypy_cache", "dist", "build", "target", ".next"}
        found: list[Path] = []
        for dirpath, dirnames, filenames in os.walk(ROOT):
            dirnames[:] = [d for d in dirnames
                           if d not in skip and not d.startswith(".")]
            found.extend(Path(dirpath) / f for f in filenames)
        _REPO_FILES = found
    return _REPO_FILES


def load_overrides() -> dict:
    if not (OVERRIDES.exists() and HAS_YAML):
        return {}
    try:
        return yaml.safe_load(OVERRIDES.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def esc(s) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#39;"))


def vscode_link(rel: str) -> str:
    return f"vscode://file/{ROOT.as_posix()}/{rel}"


def fmt_age(hours: float) -> str:
    if hours < 1:   return f"{int(hours * 60)} min ago"
    if hours < 48:  return f"{int(hours)} h ago"
    if hours < 24 * 60: return f"{int(hours / 24)} d ago"
    return f"{int(hours / 24 / 30)} mo ago"


def commits_since(mtime: float) -> int:
    """Number of commits on HEAD newer than `mtime` (a file's last write)."""
    since = datetime.fromtimestamp(mtime, timezone.utc).isoformat()
    n = git("rev-list", "--count", f"--since={since}", "HEAD")
    return int(n) if n.isdigit() else 0


def first_heading(p: Path) -> str:
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        m = re.match(r"^#+\s+(.+)$", line.strip())
        if m:
            return m.group(1).strip()
    return ""


def find_output(o: dict) -> Path:
    """Where to write HUB.html. CLI --out wins; then hub.yaml output:; then
    docs/HUB.html if docs/ exists; then root HUB.html if it already exists;
    then default to docs/HUB.html (will create the dir)."""
    if "--out" in sys.argv:
        i = sys.argv.index("--out")
        if i + 1 < len(sys.argv):
            return Path(sys.argv[i + 1]).resolve()
    if o.get("output"):
        return (ROOT / o["output"]).resolve()
    if (ROOT / "docs").is_dir():
        return ROOT / "docs" / "HUB.html"
    if (ROOT / "HUB.html").exists():
        return ROOT / "HUB.html"
    return ROOT / "docs" / "HUB.html"


def find_curated_hub(o: dict) -> Path | None:
    """Locate the curated source markdown (HUB.md) if present."""
    if o.get("curated_source"):
        p = (ROOT / o["curated_source"]).resolve()
        return p if p.exists() else None
    for rel in CURATED_CANDIDATES:
        p = ROOT / rel
        if p.exists():
            return p
    return None


def find_checkpoint(o: dict) -> Path | None:
    if o.get("checkpoint_file"):
        p = (ROOT / o["checkpoint_file"]).resolve()
        return p if p.exists() else None
    for name in CHECKPOINT_CANDIDATES:
        p = ROOT / name
        if p.exists():
            return p
    return None


# --- tiny markdown → HTML (block + inline subset) ------------------------
#
# Subset: ATX headings, paragraphs, pipe tables, bullet/numbered lists, hr,
# inline `code`, **bold**, *italic*, [text](url). Relative-path links are
# rewritten as vscode://file/... so they open in the editor.

def md_inline(text: str) -> str:
    text = esc(text)
    # Stash code spans first so inline processing doesn't touch their contents.
    spans: list[str] = []
    def _save_code(m: re.Match) -> str:
        spans.append(f'<code>{m.group(1)}</code>')
        return f"\x00C{len(spans) - 1}\x00"
    text = re.sub(r"`([^`]+)`", _save_code, text)
    # Links — rewrite repo-relative paths to vscode://
    def _link(m: re.Match) -> str:
        label, url = m.group(1), m.group(2)
        if not re.match(r"^(https?:|mailto:|vscode:|#|/)", url):
            url = vscode_link(url.lstrip("./"))
        return f'<a href="{url}">{label}</a>'
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", _link, text)
    # Bold / italic
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![*\w])\*([^*\n]+)\*(?![*\w])", r"<em>\1</em>", text)
    # Restore code spans
    for i, span in enumerate(spans):
        text = text.replace(f"\x00C{i}\x00", span)
    return text


def _parse_row(line: str) -> list[str]:
    # strip leading/trailing pipes then split
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def md_to_html(text: str) -> str:
    """Block-level renderer. Returns concatenated HTML for the input markdown."""
    if not text or not text.strip():
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    n = len(lines)
    blocks: list[str] = []
    i = 0

    def _is_table_divider(s: str) -> bool:
        return bool(re.match(r"^\s*\|?[\s\-:|]+\|?\s*$", s)) and "-" in s

    while i < n:
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            i += 1
            continue

        # horizontal rule
        if re.fullmatch(r"-{3,}|\*{3,}|_{3,}", stripped):
            blocks.append("<hr>")
            i += 1
            continue

        # heading (h3..h6 inside curated sections; we emit h3+ to avoid clashing
        # with the page-level h2.section labels)
        h = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if h:
            level = min(6, max(3, len(h.group(1)) + 1))
            blocks.append(f'<h{level}>{md_inline(h.group(2))}</h{level}>')
            i += 1
            continue

        # pipe table — must have a divider on the next line
        if "|" in line and i + 1 < n and _is_table_divider(lines[i + 1]):
            header = _parse_row(line)
            i += 2  # skip divider
            rows: list[list[str]] = []
            while i < n and lines[i].strip() and "|" in lines[i]:
                rows.append(_parse_row(lines[i]))
                i += 1
            blocks.append(_render_table(header, rows))
            continue

        # bullet list
        if re.match(r"^[-*]\s+", stripped):
            items: list[str] = []
            while i < n and re.match(r"^[-*]\s+", lines[i].lstrip()):
                content = re.sub(r"^\s*[-*]\s+", "", lines[i])
                j = i + 1
                while (j < n and lines[j].startswith(("  ", "\t")) and lines[j].strip()):
                    content += " " + lines[j].strip()
                    j += 1
                items.append(content.strip())
                i = j
            blocks.append("<ul>" + "".join(
                f"<li>{md_inline(it)}</li>" for it in items) + "</ul>")
            continue

        # numbered list
        if re.match(r"^\d+\.\s+", stripped):
            items = []
            while i < n and re.match(r"^\s*\d+\.\s+", lines[i]):
                content = re.sub(r"^\s*\d+\.\s+", "", lines[i])
                j = i + 1
                while (j < n and lines[j].startswith(("  ", "\t")) and lines[j].strip()):
                    content += " " + lines[j].strip()
                    j += 1
                items.append(content.strip())
                i = j
            blocks.append("<ol>" + "".join(
                f"<li>{md_inline(it)}</li>" for it in items) + "</ol>")
            continue

        # paragraph — collect until blank line or block-starter
        para = [line.rstrip()]
        i += 1
        while i < n and lines[i].strip():
            s = lines[i].strip()
            if (re.match(r"^#{1,6}\s+", s) or re.match(r"^[-*]\s+", s)
                    or re.match(r"^\d+\.\s+", s)):
                break
            para.append(lines[i].rstrip())
            i += 1
        joined = " ".join(p.strip() for p in para if p.strip())
        blocks.append(f"<p>{md_inline(joined)}</p>")

    return "\n".join(blocks)


def _render_table(header: list[str], rows: list[list[str]]) -> str:
    th = "".join(f"<th>{md_inline(c)}</th>" for c in header)
    body = "".join(
        "<tr>" + "".join(f"<td>{md_inline(c)}</td>" for c in r) + "</tr>"
        for r in rows
    )
    return (f'<div class="md-table-wrap"><table class="md-table">'
            f'<thead><tr>{th}</tr></thead><tbody>{body}</tbody></table></div>')


# --- curated parsing -----------------------------------------------------

def parse_curated(src: Path | None) -> dict[str, str]:
    """Return {section_key: raw_markdown_body}. Section keys are heading text
    with leading `:` stripped, lowercased, spaces→underscores. Plus a special
    `_preamble` key holding everything before the first `##` heading — that's
    where foodsafety-style files put the `**Status:** WRAPPED` leader."""
    if src is None:
        return {}
    text = src.read_text(encoding="utf-8")
    sections: dict[str, str] = {}
    pattern = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
    matches = list(pattern.finditer(text))
    if matches:
        sections["_preamble"] = text[:matches[0].start()].strip()
    else:
        sections["_preamble"] = text.strip()
    for idx, m in enumerate(matches):
        head = m.group(1).strip()
        key = head.lstrip(":").strip().lower().replace(" ", "_")
        start = m.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        sections[key] = text[start:end].strip()
    return sections


def parse_table_to_cards(md: str) -> list[dict]:
    """Pull a markdown table into [{name, path, desc}, ...]. First col → name,
    second col → raw path cell (backticks preserved — _annotate_age handles
    extraction), remaining cols joined → desc."""
    cards = []
    lines = md.split("\n")
    i = 0
    while i < len(lines):
        if "|" in lines[i] and i + 1 < len(lines) and re.match(
                r"^\s*\|?[\s\-:|]+\|?\s*$", lines[i + 1]) and "-" in lines[i + 1]:
            header = _parse_row(lines[i])  # noqa: F841 — kept for symmetry
            i += 2
            while i < len(lines) and lines[i].strip() and "|" in lines[i]:
                cells = _parse_row(lines[i])
                if len(cells) >= 2:
                    name = re.sub(r"^`(.+?)`$", r"\1", cells[0]).lstrip(":")
                    # keep cells[1] verbatim; _annotate_age uses re.findall on
                    # backticks, so leaving the cell intact handles both
                    # single-path (`a.md`) and multi-path (`a.md`, `a.pdf`).
                    path = cells[1]
                    desc = " · ".join(cells[2:]) if len(cells) > 2 else ""
                    cards.append({"name": name, "path": path, "desc": desc})
                i += 1
        else:
            i += 1
    return cards


def parse_bullets_to_cards(md: str) -> list[dict]:
    """Pull `- `:name` — description` (or `- **name** — description`) bullets.
    Trailing horizontal rules (`---`) and section-end whitespace are dropped."""
    cards = []
    pat = re.compile(
        r"^- (?:`(:?[^`]+)`|\*\*([^*]+)\*\*)\s*[—\-]\s*(.+)$",
        re.MULTILINE,
    )
    text = md
    for m in pat.finditer(text):
        name = (m.group(1) or m.group(2) or "").lstrip(":")
        desc = m.group(3).strip()
        start = m.end()
        rest = text[start:].split("\n- ", 1)[0]
        # strip continuation lines that are just horizontal rules or whitespace
        cont = []
        for line in rest.split("\n"):
            s = line.strip()
            if not s or re.fullmatch(r"-{3,}|\*{3,}|_{3,}", s):
                continue
            cont.append(s)
        full = (desc + " " + " ".join(cont)).strip()
        full = re.sub(r"\s+", " ", full)
        if len(full) > 320:
            full = full[:317].rsplit(" ", 1)[0] + "…"
        cards.append({"name": name, "desc": full})
    return cards


# --- derivers ------------------------------------------------------------

def derive_project_name(o: dict, curated: dict) -> str:
    if o.get("name"):
        return o["name"]
    if README.exists():
        for line in README.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^#\s+(.+)$", line.strip())
            if m:
                # drop trailing "— foo" descriptor for the headline
                return re.sub(r"\s+[—\-]\s+.+$", "", m.group(1).strip())
    return ROOT.name


def derive_oneliner(o: dict, curated: dict) -> str:
    """Find a one-sentence project description. Priority (best signal first):
    1. hub.yaml `oneliner:` / `tagline:`
    2. curated `## :oneline` / `## :about` / similar
    3. CLAUDE.md `## Project` / `## About` / `## Overview` body
    4. README H1 trailing "— descriptor"
    5. First prose paragraph of README
    6. First prose paragraph of HUB.md preamble (skipping bold leaders + instruction
       leaders like "When Claude…", "Read this first…")
    """
    if o.get("oneliner"):
        return o["oneliner"]
    if o.get("tagline"):
        return o["tagline"]
    for key in ("oneline", "one_line", "tagline", "about", "overview"):
        if key in curated:
            txt = curated[key].strip().split("\n", 1)[0]
            if txt:
                return _clean_oneline(txt)
    if CLAUDE_MD.exists():
        text = CLAUDE_MD.read_text(encoding="utf-8")
        m = re.search(r"^##\s+(Project|About|Overview)\s*$\n+(.+?)(?=\n##\s+|\Z)",
                       text, re.MULTILINE | re.DOTALL)
        if m:
            for para in re.split(r"\n\s*\n", m.group(2)):
                cleaned = _first_prose_line(para)
                if cleaned:
                    return _clean_oneline(cleaned)
    if README.exists():
        for line in README.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^#\s+.+?\s+[—\-]\s+(.+)$", line.strip())
            if m:
                return _clean_oneline(m.group(1))
        for para in re.split(r"\n\s*\n", README.read_text(encoding="utf-8")):
            cleaned = _first_prose_line(para)
            if cleaned:
                return _clean_oneline(cleaned)
    if curated.get("_preamble"):
        for para in re.split(r"\n\s*\n", curated["_preamble"]):
            cleaned = _first_prose_line(para)
            if cleaned:
                return _clean_oneline(cleaned)
    return ""


# Sentences that read as "instructions to the agent", not a project description.
_INSTRUCTION_LEADERS = re.compile(
    r"^(when\s+claude|read\s+this|start\s+here|if\s+you[\'’]re\s+starting|"
    r"always\s+|please\s+|don[\'’]?t\s+|never\s+|first[,:]\s)",
    re.IGNORECASE,
)


def _first_prose_line(para: str) -> str:
    p = para.strip()
    if not p or p.startswith(("#", "```", "|", "<!--", "- ", "* ", "1.")):
        return ""
    first = p.split("\n")[0].strip()
    # skip bold-leader lines like "**Status:** WRAPPED ..." and meta-instructions
    if re.match(r"^\*\*[^*]+:\*\*", first):
        return ""
    cleaned = re.sub(r"[*_`]", "", first).strip()
    if _INSTRUCTION_LEADERS.match(cleaned):
        return ""
    return first


def _clean_oneline(text: str) -> str:
    text = re.sub(r"[*_`]", "", text).strip()
    # take first sentence (split on . ! ? followed by space + cap or EOL)
    m = re.match(r"^([^.!?]+[.!?])(?:\s+[A-Z]|$)", text)
    if m:
        text = m.group(1).strip()
    if len(text) > 200:
        text = text[:197].rsplit(" ", 1)[0] + "…"
    return text


def derive_status(o: dict, curated: dict) -> dict:
    """{pill, reason, color}. hub.yaml status: wins; then curated `## :status`
    first sentence inspected for keywords; else activity-based heuristic."""
    if o.get("status"):
        return {
            "pill": o["status"],
            "reason": o.get("status_reason", ""),
            "color": o.get("status_color", PALETTE["ok"]),
        }
    # Curated keyword sniffing — scan preamble + :status body for the pill.
    # Recognises three common conventions:
    #   `**Status:** WRAPPED · reason …`        (foodsafety leader)
    #   `**WRAPPED**`                            (bold pill mid-sentence)
    #   `The project is **wrapped**.`            (lowercase, in prose)
    target = ((curated.get("_preamble", "") or "") + "\n\n"
              + (curated.get("status", "") or ""))[:1500]
    if target.strip():
        # `**Status:** KEYWORD reason …`
        m = re.search(r"\*\*Status:?\*\*\s*(?:`)?([A-Za-z][A-Za-z _0-9/\-]{2,30})(?:`)?"
                      r"(?:\s*[·•\-—]\s*([^\n*]+))?", target)
        if not m:
            # standalone **KEYWORD** in bold
            m = re.search(r"\*\*([A-Z][A-Z _0-9]{2,30})\*\*", target)
        if not m:
            # in-prose "is **wrapped**" / "**done**"
            m = re.search(r"\bis\s+\*\*([a-zA-Z][a-zA-Z _0-9]{2,30})\*\*", target)
        if m:
            pill = m.group(1).strip().upper()
            color = (PALETTE["dim"] if pill in {"WRAPPED", "DONE", "FROZEN", "ARCHIVED", "CLOSED"}
                     else PALETTE["warn"] if pill in {"BLOCKED", "STALLED", "ON HOLD"}
                     else PALETTE["ok"])
            reason = ""
            if m.lastindex and m.lastindex >= 2 and m.group(2):
                reason = m.group(2).strip()
            if not reason:
                rest = target[m.end():].strip()
                sentence = re.split(r"(?<=[.!?])\s+", rest)[0] if rest else ""
                reason = re.sub(r"[*_`\[\]]", "", sentence).strip()
            if len(reason) > 160:
                reason = reason[:157].rsplit(" ", 1)[0] + "…"
            return {"pill": pill, "reason": reason, "color": color, "source": "curated"}
    last_commit_ts = git("log", "-1", "--format=%ct")
    uncommitted = len([ln for ln in git("status", "-s").splitlines() if ln.strip()])
    if not last_commit_ts:
        return {"pill": "EMPTY", "reason": "no commits", "color": PALETTE["dim"]}
    age_h = (datetime.now(timezone.utc).timestamp() - int(last_commit_ts)) / 3600
    if uncommitted > 30 or age_h < 24:
        pill, color = "ACTIVE", PALETTE["ok"]
    elif age_h < 24 * 7:
        pill, color = "IN PROGRESS", PALETTE["air"]
    elif age_h < 24 * 30:
        pill, color = "IDLE", PALETTE["warn"]
    else:
        pill, color = "DORMANT", PALETTE["dim"]
    bits = [f"last commit {fmt_age(age_h)}"]
    if uncommitted:
        bits.append(f"{uncommitted} uncommitted")
    return {"pill": pill, "reason": " · ".join(bits), "color": color}


def derive_loose_ends() -> dict:
    """Live git state: uncommitted, unpushed, TODOs, recent draft files.
    Paths are normalised to be ROOT-relative even when ROOT is a subdirectory
    of the enclosing git repo (git would otherwise return toplevel-relative
    paths, which would render as broken doubled URLs)."""
    out: dict = {"uncommitted": [], "unpushed": [], "todos": [], "drafts": []}
    prefix = git_subdir_prefix()   # "" or "foodsafety/" style

    def _normalise(path: str) -> str | None:
        if prefix:
            if path.startswith(prefix):
                return path[len(prefix):]
            # path is OUTSIDE our subdir — surface it but flag the "../" jump
            return "../" + path
        return path

    # uncommitted (porcelain) — use git_raw because " M path" has a leading
    # space that the global .strip() would eat, mis-aligning column parsing.
    for line in git_raw("status", "--porcelain").splitlines():
        if not line.strip():
            continue
        # format: 'XY PATH' where XY is exactly 2 chars + 1 space + PATH
        status = line[:2].strip() or "??"
        path = line[3:].rstrip()
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        normalised = _normalise(path)
        if normalised is None:
            continue
        out["uncommitted"].append({"status": status, "path": normalised})

    # unpushed (only meaningful with an upstream)
    raw = git("log", "@{u}..HEAD", "--format=%h\t%s\t%ar")
    for line in raw.splitlines():
        parts = line.split("\t")
        if len(parts) == 3:
            out["unpushed"].append({"hash": parts[0], "subject": parts[1], "when": parts[2]})

    # TODOs — git grep across tracked files, cap to 12 to keep the panel sane.
    # Data/generated file types are excluded: on a repo with hundreds of MB of
    # tracked CSV/JSON the grep took ~9 s and blew the session-start budget.
    raw = git("grep", "-nE", "-I", "(TODO|FIXME|XXX|HACK)\\b", "--", ".",
              *(f":(exclude)*.{ext}" for ext in TODO_SKIP_EXTS))
    seen = 0
    for line in raw.splitlines():
        # 'path:line:content'
        m = re.match(r"^([^:]+):(\d+):(.*)$", line)
        if not m:
            continue
        # skip the build script itself (it MENTIONS TODO in the regex)
        if m.group(1).endswith("scripts/build_hub.py"):
            continue
        normalised = _normalise(m.group(1))
        if normalised is None:
            continue
        text = m.group(3).strip()
        if len(text) > 110:
            text = text[:107].rsplit(" ", 1)[0] + "…"
        out["todos"].append({"path": normalised, "line": int(m.group(2)), "text": text})
        seen += 1
        if seen >= 12:
            break

    # drafts — files (in or out of git) whose name screams "in flight"
    cutoff = datetime.now(timezone.utc).timestamp() - 7 * 24 * 3600
    drafts: list[dict] = []
    for p in repo_files():
        name_lower = p.name.lower()
        if not any(pat in name_lower for pat in DRAFT_PATTERNS):
            continue
        rel = p.relative_to(ROOT).as_posix()
        if any(seg in rel for seg in ("node_modules/", "DerivedData/",
                                      "__pycache__/", ".matplotlib-cache/")):
            continue
        try:
            mtime = p.stat().st_mtime
        except OSError:
            continue
        if mtime < cutoff:
            continue
        drafts.append({"path": rel, "when": fmt_age((datetime.now(timezone.utc).timestamp() - mtime) / 3600)})
    drafts.sort(key=lambda d: d["when"])
    out["drafts"] = drafts[:8]

    return out


def derive_next_action(o: dict, curated: dict, status: dict, loose: dict) -> str:
    if o.get("next_action"):
        return o["next_action"]
    for key in ("next", "next_action", "todo"):
        if key in curated and curated[key].strip():
            first = curated[key].strip().split("\n", 1)[0]
            first = re.sub(r"^[-*]\s+", "", first)
            first = re.sub(r"[*`]", "", first).strip()
            if first:
                return first
    if status["pill"] in {"WRAPPED", "DONE", "FROZEN", "ARCHIVED", "DORMANT"}:
        return "(project closed — no active to-do)"
    if loose["uncommitted"]:
        n = len(loose["uncommitted"])
        return f"finish or roll back {n} uncommitted file{'s' if n > 1 else ''}"
    if loose["unpushed"]:
        n = len(loose["unpushed"])
        return f"push {n} unsynced commit{'s' if n > 1 else ''} to remote"
    if loose["todos"]:
        return f"{len(loose['todos'])}+ TODO/FIXME open in code"
    if loose["drafts"]:
        d = loose["drafts"][0]
        return f"resume draft {d['path']} (last touched {d['when']})"
    return "(no clear next step detected)"


def derive_curated_ages(o: dict, curated: dict, status: dict) -> dict:
    """{"next": info, "status": info} for the hand-written file behind each
    line, or None when the line was auto-derived (brief only). A curated line
    never updates itself, so the reader must see how old it is. Stale = ≥2
    commits since (same rule as the handover) or older than 30 days; closed
    projects skip the 30-day rule because their status is meant to stay put."""
    hub_md = find_curated_hub(o)
    now = datetime.now(timezone.utc).timestamp()
    closed = status["pill"] in {"WRAPPED", "DONE", "FROZEN", "ARCHIVED", "CLOSED"}

    def info(p: Path | None) -> dict | None:
        if p is None:
            return None
        try:
            mtime = p.stat().st_mtime
        except OSError:
            return None
        n = commits_since(mtime)
        days = (now - mtime) / 86400
        return {"path": p.relative_to(ROOT).as_posix(),
                "age": fmt_age((now - mtime) / 3600), "commits_since": n,
                "stale": n >= 2 or (days > 30 and not closed)}

    next_curated = any((curated.get(k) or "").strip()
                       for k in ("next", "next_action", "todo"))
    next_src = (OVERRIDES if o.get("next_action")
                else hub_md if next_curated else None)
    status_src = (OVERRIDES if o.get("status")
                  else hub_md if status.get("source") == "curated" else None)
    return {"next": info(next_src), "status": info(status_src)}


def derive_script_update() -> str | None:
    """The skill master's HUB_VERSION if it is newer than this copy's, else
    None. Silent on machines without the skill and when run as the master."""
    try:
        if (not SKILL_MASTER.exists()
                or Path(__file__).resolve() == SKILL_MASTER.resolve()):
            return None
        m = re.search(r'^HUB_VERSION = "([^"]+)"',
                      SKILL_MASTER.read_text(encoding="utf-8"), re.MULTILINE)
    except OSError:
        return None
    return m.group(1) if m and m.group(1) > HUB_VERSION else None


def derive_checkpoint(o: dict) -> dict | None:
    p = find_checkpoint(o)
    if not p:
        return None
    text = p.read_text(encoding="utf-8", errors="replace")
    # first paragraph after the first heading; fall back to first 600 chars
    paras = re.split(r"\n\s*\n", text)
    snippet = ""
    for para in paras:
        s = para.strip()
        if not s or s.startswith(("#", "```", "<!--")):
            continue
        # drop bold-only leader lines like "**Status:** WRAPPED" — we want the prose
        if re.fullmatch(r"\*\*[^*]+\*\*[^.]*", s):
            continue
        snippet = s
        break
    if not snippet:
        snippet = text[:600].strip()
    snippet = re.sub(r"\s+", " ", snippet)
    if len(snippet) > 500:
        snippet = snippet[:497].rsplit(" ", 1)[0] + "…"
    mtime = None
    try:
        mtime = p.stat().st_mtime
        age = fmt_age((datetime.now(timezone.utc).timestamp() - mtime) / 3600)
    except OSError:
        age = ""
    # Staleness: commits landed after the handover was written mean the repo
    # moved on without it. Threshold 2, not 1 — the normal "write handover,
    # then commit everything" flow puts exactly one commit after the mtime.
    n_since = commits_since(mtime) if mtime is not None else 0
    return {"path": p.relative_to(ROOT).as_posix(), "snippet": snippet, "age": age,
            "mtime": mtime, "commits_since": n_since,
            "stale": n_since >= 2}


AUTO_CHECKPOINT_DIR = Path.home() / ".claude" / "checkpoints" / "by-project"


def derive_auto_checkpoint() -> dict | None:
    """Machine-written session checkpoint, if the user's harness has a Stop
    hook that writes one to ~/.claude/checkpoints/by-project/<dirname>.md
    (keyed by the session cwd's basename, sanitized). Unlike HANDOVER.md it
    needs no model discipline, so it stays current even when the last session
    ended without a handover write. Brief-only freshness fallback; returns
    None on machines without the hook. The 'Environment State' section is
    deliberately dropped — the brief already shows LIVE git state, and a
    stale copy of it would mislead."""
    base = ROOT.name or "unknown"
    safe = "".join(c if (c.isalnum() or c in "-_.") else "_" for c in base) or "unknown"
    p = AUTO_CHECKPOINT_DIR / f"{safe}.md"
    if not p.exists():
        return None
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
        mtime = p.stat().st_mtime
    except OSError:
        return None
    sections: dict[str, list[str]] = {}
    current = ""
    for line in text.splitlines():
        m = re.match(r"^##\s+(.+)$", line)
        if m:
            current = m.group(1).strip().lower()
            continue
        s = line.strip()
        if s and current and not s.startswith("#"):
            sections.setdefault(current, []).append(s)

    def items_for(prefix: str, cap: int) -> list[str]:
        for k, v in sections.items():
            if k.startswith(prefix):
                out = []
                for x in v:
                    if not x.startswith("-"):
                        continue
                    it = re.sub(r"^-\s*", "", x)
                    if not it or it == "(none)":
                        continue
                    it = it.replace(ROOT.as_posix() + "/", "")
                    # Paths still absolute after the ROOT strip live outside
                    # the repo (scratchpads, ~/.claude memory) — noise here.
                    if it.startswith(("/", "~/")):
                        continue
                    out.append(it)
                more = len(out) - cap
                return out[:cap] + ([f"+{more} more"] if more > 0 else [])
        return []

    def quoted(prefix: str, cap: int) -> str:
        for k, v in sections.items():
            if k.startswith(prefix):
                joined = " ".join(re.sub(r"^>\s*", "", x) for x in v)
                return re.sub(r"\s+", " ", joined)[:cap]
        return ""

    hours = (datetime.now(timezone.utc).timestamp() - mtime) / 3600
    return {"path": p.as_posix(), "age": fmt_age(hours), "mtime": mtime,
            "completed": items_for("completed", 6),
            "in_progress": items_for("in progress", 4),
            "next_steps": items_for("next steps", 4),
            "summary": quoted("last assistant summary", 350),
            "last_prompt": quoted("last user prompt", 200)}


def derive_waves(o: dict, curated: dict) -> list[dict]:
    if o.get("waves"):
        return o["waves"]
    log = git("log", "--format=%s", "--reverse")
    prefix_re = re.compile(r"^(#\d+)\s+(.{0,40})")
    by_prefix: dict[str, dict] = {}
    for line in log.splitlines():
        m = prefix_re.match(line.strip())
        if not m:
            continue
        key = m.group(1)
        by_prefix.setdefault(key, {"label": key, "sub": m.group(2).strip(), "count": 0})
        by_prefix[key]["count"] += 1
    if len(by_prefix) >= 3:
        waves = list(by_prefix.values())
        for i, w in enumerate(waves):
            w["color"] = PALETTE["ok"] if i == len(waves) - 1 else PALETTE["thesis"]
        return waves
    # cluster by month
    months: Counter = Counter()
    for ts in git("log", "--format=%ct").splitlines():
        try:
            d = datetime.fromtimestamp(int(ts), tz=timezone.utc)
            months[d.strftime("%Y-%m")] += 1
        except ValueError:
            continue
    waves = []
    items = sorted(months.items())
    for i, (m, c) in enumerate(items):
        waves.append({
            "label": f"W{i + 1}",
            "sub": datetime.strptime(m, "%Y-%m").strftime("%b %Y").lower(),
            "count": c,
            "color": PALETTE["ok"] if i == len(items) - 1 else PALETTE["thesis"],
        })
    return waves[-9:]


def derive_concepts(o: dict, curated: dict) -> list[dict]:
    """Curated `## :concepts` bullets WIN; else CONTEXT.md bullets; else nothing."""
    if o.get("concepts"):
        return o["concepts"]
    if "concepts" in curated:
        cards = parse_bullets_to_cards(curated["concepts"])
        if cards:
            return cards
    if not CONTEXT.exists():
        return []
    text = CONTEXT.read_text(encoding="utf-8")
    cards: list[dict] = []
    pat = re.compile(r"^- \*\*(.+?)\*\*\s*[—\-]\s*(.+)$", re.MULTILINE)
    for m in pat.finditer(text):
        name = m.group(1).strip()
        region = text[m.end():]
        # a term's description runs until the next bullet, a blank line, or a
        # markdown heading — so a `## Invariants` section right after the
        # vocabulary list isn't swallowed into the last term's description.
        stop = len(region)
        for marker in ("\n- ", "\n\n", "\n#"):
            idx = region.find(marker)
            if idx != -1:
                stop = min(stop, idx)
        rest = region[:stop].strip()
        desc = re.sub(r"\s+", " ", m.group(2).strip() + " " + rest).strip()
        if len(desc) > 220:
            desc = desc[:217].rsplit(" ", 1)[0] + "…"
        cards.append({"name": name, "desc": desc})
    return cards


def derive_scripts(o: dict) -> list[dict]:
    if o.get("scripts"):
        return o["scripts"]
    items: list[dict] = []
    if SCRIPTS_DIR.is_dir():
        for p in sorted(SCRIPTS_DIR.iterdir()):
            if p.is_file() and not p.name.startswith("."):
                rel = p.relative_to(ROOT).as_posix()
                items.append({"name": p.name, "path": rel, "kind": "script"})

    # Scan every package.json in the repo (root + immediate subdirs), not just
    # `website/`. Multi-package monorepos (frontend/ + backend/, apps/web +
    # apps/api, …) and root-package projects all surface here. Labels include
    # the host directory so multiple `npm run dev` entries stay distinguishable.
    package_jsons: list[Path] = []
    if (ROOT / "package.json").exists():
        package_jsons.append(ROOT / "package.json")
    for child in sorted(ROOT.iterdir()) if ROOT.exists() else []:
        if child.is_dir() and child.name not in {"node_modules", ".git"} \
                and not child.name.startswith("."):
            cand = child / "package.json"
            if cand.exists():
                package_jsons.append(cand)
    for pkg in package_jsons:
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
            host_dir = pkg.parent.relative_to(ROOT).as_posix() or "."
            label_prefix = "" if host_dir == "." else f"{host_dir}/"
            for k, v in (data.get("scripts") or {}).items():
                items.append({
                    "name": f"npm run {k}" + (f" ({host_dir})" if host_dir != "." else ""),
                    "path": f"{label_prefix}package.json · {v}",
                    "kind": "npm",
                })
        except Exception:
            pass

    mf = ROOT / "Makefile"
    if mf.exists():
        for m in re.finditer(r"^([A-Za-z0-9_\-]+):",
                              mf.read_text(encoding="utf-8"), re.M):
            items.append({"name": f"make {m.group(1)}",
                          "path": "Makefile", "kind": "make"})
    return items


def derive_guardrails(o: dict, curated: dict) -> list[dict]:
    """Files that stop accidents — pre-commit hooks, CI workflows, check-/verify-/
    lint- scripts, RLS-style policy tests, secret-scan configs, ops runbooks, and
    the narrative rulebook in CLAUDE.md. Each carries a plain-English "what it
    protects" sentence so a non-coder can tell what would break if it were
    removed.

    Override precedence:
      hub.yaml: guardrails: [...]            (full replace, structured)
      ## :guardrails table in HUB.md         (full replace, parsed)
      otherwise → auto-derived from filesystem patterns

    kind ∈ {block, test, config, runbook, rules} — drives card left-border colour.
    """
    if o.get("guardrails"):
        return o["guardrails"]

    # Curated HUB.md table: | Name | Path | When | Kind |
    if "guardrails" in curated:
        cards = parse_table_to_cards(curated["guardrails"])
        if cards:
            out = []
            for c in cards:
                # Strip backticks from path cell
                path_raw = re.sub(r"^`(.+?)`$", r"\1", c["path"].strip())
                desc_parts = [s.strip() for s in (c.get("desc") or "").split("·") if s.strip()]
                when = desc_parts[0] if desc_parts else ""
                kind = (desc_parts[1].lower() if len(desc_parts) > 1 else "block")
                if kind not in {"block", "test", "config", "runbook", "rules"}:
                    kind = "block"
                out.append({"name": c["name"], "path": path_raw,
                            "protects": " · ".join(desc_parts[2:]) if len(desc_parts) > 2 else
                                        "Custom guardrail (see HUB.md for context).",
                            "when": when, "kind": kind})
            return out

    items: list[dict] = []
    seen: set[str] = set()

    def add(name: str, path, protects: str, when: str, kind: str) -> None:
        rel = path if isinstance(path, str) else path.relative_to(ROOT).as_posix()
        if rel in seen:
            return
        seen.add(rel)
        items.append({"name": name, "path": rel, "protects": protects,
                      "when": when, "kind": kind})

    # 1. Local git hooks
    husky = ROOT / ".husky"
    if husky.is_dir():
        for p in sorted(husky.iterdir()):
            if not p.is_file() or p.name.startswith(("_", ".")):
                continue
            hook = p.name
            verb = hook.replace("-", " ").replace("pre ", "")
            add(name=f"{hook} hook", path=p,
                protects=(f"Runs before every git {verb}. If anything inside "
                          f"fails, the action is blocked — your commit doesn't "
                          f"happen, the push doesn't go through. Don't bypass "
                          f"with --no-verify; fix the underlying issue."),
                when=f"Every git {verb}", kind="block")

    # 2. GitHub Actions workflows
    gha = ROOT / ".github" / "workflows"
    if gha.is_dir():
        for p in sorted(gha.iterdir()):
            if p.suffix in {".yml", ".yaml"} and p.is_file():
                add(name=f"CI workflow — {p.stem}", path=p,
                    protects=("Runs on the server when you push or open a "
                              "pull request. Failures show as red checks on "
                              "the PR and block merging."),
                    when="Every push and pull request", kind="block")

    # 3. Hook orchestrators + secret-scan configs
    for fname, label, protects in [
        (".pre-commit-config.yaml", "pre-commit framework config",
         "Defines which checks run when the pre-commit hook fires."),
        (".lefthook.yml", "Lefthook config",
         "Defines which checks run when each git hook fires."),
        ("lefthook.yml", "Lefthook config",
         "Defines which checks run when each git hook fires."),
        (".gitleaks.toml", "gitleaks secret-scan rules",
         "Pattern list that blocks secrets (API keys, tokens) from being committed."),
        (".gitleaksignore", "gitleaks ignore-list",
         "Specific file paths the secret scanner is allowed to skip."),
    ]:
        p = ROOT / fname
        if p.exists():
            add(name=label, path=p, protects=protects,
                when="Loaded by the hooks above", kind="config")

    # 4. Safety scripts in scripts/
    safety_prefix = re.compile(r"^(check|verify|validate|lint|audit|scan)[-_]", re.I)
    if SCRIPTS_DIR.is_dir():
        for p in sorted(SCRIPTS_DIR.iterdir()):
            if not p.is_file() or p.name.startswith("."):
                continue
            if safety_prefix.match(p.name):
                stem = re.sub(r"^(check|verify|validate|lint|audit|scan)[-_]", "",
                              p.stem, flags=re.I)
                pretty = stem.replace("-", " ").replace("_", " ").strip().capitalize()
                add(name=f"Check: {pretty}", path=p,
                    protects=("A single check script. Fails the hook (and your "
                              "commit) if the rule it enforces is broken. Read "
                              "the top of the file to see exactly what it looks for."),
                    when="Run by the pre-commit hook or manually", kind="block")

    # 5. Policy / RLS / security tests (filename-pattern match across the repo)
    policy_test_re = re.compile(
        r"(^|/)(rls|policy|policies|permission|permissions|security|access)[._-]?[^/]*\.(test|spec)\.[a-z]+$",
        re.I,
    )
    skip_segs = {".git", "node_modules", "DerivedData", "_orig", "_old",
                 "dist", "build", "target"}
    for p in sorted(repo_files()):
        rel = p.relative_to(ROOT).as_posix()
        if any(seg in rel.split("/") for seg in skip_segs):
            continue
        if policy_test_re.search(rel):
            add(name=f"Policy test — {p.name}", path=p,
                protects=("A test that fails the test suite if a policy rule "
                          "(e.g. cross-user data access, admin-only routes) is "
                          "broken. It's the safety net that catches a bad "
                          "migration or weakened policy after the fact."),
                when="CI test runs and local test commands", kind="test")

    # 6. Ops / security runbooks
    runbook_keywords = ("security", "incident", "breach", "runbook", "rls",
                        "policy", "admin-bootstrap", "backup", "restore",
                        "rotation", "disaster")
    for sub in ("ops", "security", "runbooks", "runbook"):
        d = ROOT / "docs" / sub
        if not d.is_dir():
            continue
        for p in sorted(d.glob("*.md")):
            if any(k in p.stem.lower() for k in runbook_keywords):
                pretty = p.stem.replace("-", " ").replace("_", " ").strip().capitalize()
                add(name=f"Runbook: {pretty}", path=p,
                    protects=("Tells a human what to do when something has already "
                              "gone wrong (suspected breach, key rotation, restore "
                              "from backup, etc.)."),
                    when="During an incident", kind="runbook")

    # 7. Narrative rulebook in CLAUDE.md
    if CLAUDE_MD.exists():
        text = CLAUDE_MD.read_text(encoding="utf-8", errors="ignore")
        strong = re.search(
            r"^##\s+([^\n]*?(?:Regeln|Rules\b|NEVER\b|NIEMALS\b)[^\n]*)$",
            text, re.M | re.I,
        )
        weak = re.search(
            r"^##\s+([^\n]*?(?:Constraints|Conventions)[^\n]*)$",
            text, re.M | re.I,
        )
        m = strong or weak
        if m:
            heading_text = re.sub(r"^[^\w]+", "", m.group(1)).strip()
            anchor = re.sub(r"[^\w\s-]", "", heading_text.lower()).strip()
            anchor = re.sub(r"\s+", "-", anchor)
            add(name="The rulebook (CLAUDE.md)",
                path=f"CLAUDE.md#{anchor}" if anchor else "CLAUDE.md",
                protects=("The narrative list of what AI agents (and humans) must "
                          "NEVER do and what they must ALWAYS do. Every other "
                          "guardrail on this page is the mechanical enforcement "
                          "of one of these rules."),
                when="Read before any non-trivial change", kind="rules")

    return items


def derive_canonical(o: dict, curated: dict) -> list[dict]:
    if o.get("canonical_refs"):
        return o["canonical_refs"]
    if "canonical" in curated:
        cards = parse_table_to_cards(curated["canonical"])
        if cards:
            # enrich with mtime-age so 2am-Tim sees freshness
            for c in cards:
                _annotate_age(c)
            return cards
    # auto-derive: README, CLAUDE.md, CONTEXT.md, INDEX.md + newest of docs/<sub>/
    items: list[dict] = []
    if README.exists():
        items.append({"name": "README", "path": "README.md",
                      "desc": "Project README — first-read entry point."})
    if CLAUDE_MD.exists():
        items.append({"name": "CLAUDE.md", "path": "CLAUDE.md",
                      "desc": "Agent rules + project conventions."})
    if CONTEXT.exists():
        items.append({"name": "CONTEXT.md", "path": "CONTEXT.md",
                      "desc": "Domain vocabulary."})
    if (ROOT / "docs" / "INDEX.md").exists():
        items.append({"name": "INDEX.md", "path": "docs/INDEX.md",
                      "desc": "Repo node map — code structure by area."})
    docs = ROOT / "docs"
    if docs.is_dir():
        for sub in sorted(docs.iterdir()):
            if not sub.is_dir() or sub.name in {"adr", "plans"}:
                continue
            cands = [p for p in sub.rglob("*")
                     if p.is_file() and p.suffix in {".pdf", ".html", ".md", ".docx"}
                     and "_orig" not in p.parts and "_old" not in p.parts]
            if not cands:
                continue
            newest = max(cands, key=lambda p: p.stat().st_mtime)
            items.append({
                "name": sub.name, "path": newest.relative_to(ROOT).as_posix(),
                "desc": f"Most-recent {newest.suffix.lstrip('.').upper()} in docs/{sub.name}/",
            })
    for c in items:
        _annotate_age(c)
    return items


def _annotate_age(card: dict) -> None:
    """Attach `age` and `path_primary` to a card dict if any of its paths
    resolves on disk. Handles cells of the form:
      - `path`
      - `path1, path2, path3`           (multi-path; first existing wins)
      - `` `../sister/` (28-step …) ``  (backtick + comment)
      - `../sister/`                    (out-of-repo — marked external)
    """
    p = card.get("path", "")
    # extract backtick-wrapped tokens first; if any, those are the actual paths
    backticked = re.findall(r"`([^`]+)`", p)
    if backticked:
        candidates = backticked
    else:
        candidates = [c.strip() for c in re.split(r"[,;]", p) if c.strip()]
    candidates = [c.strip().rstrip("/") for c in candidates if c.strip()]
    in_repo = [c for c in candidates if not c.startswith(("../", "/", "http"))]
    if not in_repo and candidates:
        card["exists"] = True
        card["age"] = "external"
        card["path_primary"] = candidates[0]
        return
    for cand in in_repo:
        abs_p = ROOT / cand
        if abs_p.exists():
            try:
                mtime = abs_p.stat().st_mtime
                card["age"] = fmt_age((datetime.now(timezone.utc).timestamp() - mtime) / 3600)
                card["exists"] = True
                card["path_primary"] = cand
                return
            except OSError:
                pass
    card["exists"] = False
    if in_repo:
        card["path_primary"] = in_repo[0]


def derive_collaborators(o: dict, curated: dict) -> list[dict]:
    if o.get("collaborators"):
        return o["collaborators"]
    if "collaborators" in curated:
        cards = parse_bullets_to_cards(curated["collaborators"])
        if cards:
            return [{"name": c["name"], "count": c["desc"]} for c in cards]
    raw = git("shortlog", "-sn", "HEAD")
    out: list[dict] = []
    for line in raw.splitlines():
        m = re.match(r"\s*(\d+)\s+(.+)$", line)
        if m:
            out.append({"name": m.group(2).strip(), "count": f"{m.group(1)} commits"})
    return out


def derive_superseded(curated: dict) -> dict:
    """Return {'curated_md': str or '', 'items': list of {path, parent}}."""
    if "superseded" in curated:
        return {"curated_md": curated["superseded"], "items": []}
    patterns = [
        re.compile(r"(^|/)_orig($|/)"),
        re.compile(r"(^|/)_old($|/)"),
        re.compile(r"(^|/)_v\d+($|/)"),
        re.compile(r"(^|/).*backup.*", re.IGNORECASE),
        re.compile(r"(^|/).*\.archived[-_].*"),
    ]
    # directories = ancestors of git-visible files (a dir whose entire content
    # is gitignored is junk, not a superseded artifact worth surfacing)
    dirs: set[str] = set()
    for p in repo_files():
        for parent in p.relative_to(ROOT).parents:
            s = parent.as_posix()
            if s != ".":
                dirs.add(s)
    seen: set[str] = set()
    items: list[dict] = []
    for rel in dirs:
        if any(seg in ("node_modules", "DerivedData") for seg in rel.split("/")):
            continue
        for rx in patterns:
            if rx.search(rel):
                parent = Path(rel).parent.as_posix() or "(root)"
                if rel not in seen:
                    items.append({"path": rel, "parent": parent})
                    seen.add(rel)
                break
    items.sort(key=lambda x: x["path"])
    return {"curated_md": "", "items": items}


def derive_decisions() -> list[dict]:
    if not ADR_DIR.is_dir():
        return []
    out = []
    for p in sorted(ADR_DIR.glob("*.md")):
        out.append({"path": p.relative_to(ROOT).as_posix(),
                    "title": first_heading(p) or p.stem})
    return out


def derive_plans() -> list[dict]:
    if not PLANS_DIR.is_dir():
        return []
    out = []
    for p in sorted(PLANS_DIR.glob("*.md")):
        out.append({"path": p.relative_to(ROOT).as_posix(),
                    "title": first_heading(p) or p.stem})
    return out


def derive_learnings(limit: int = 10) -> list[str]:
    """Last `limit` bullet entries of LEARNINGS.md (root, falls back to docs/).
    Append-only project gotchas the agent records when corrected; surfaced in
    the --brief output only, not in HUB.html."""
    p = LEARNINGS if LEARNINGS.exists() else ROOT / "docs" / "LEARNINGS.md"
    if not p.exists():
        return []
    entries: list[str] = []
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if s.startswith(("- ", "* ")):
            entries.append(s[2:].strip())
    return entries[-limit:]


def derive_memory_ages() -> list[str]:
    """One-glance freshness of the write-side memory files (brief only).
    Facts, not verdicts — an unchanged CONTEXT.md can be a stable domain, so
    only the reader can judge; a 'missing' entry is itself the signal."""
    now = datetime.now(timezone.utc).timestamp()

    def age(p: Path) -> str:
        try:
            return fmt_age((now - p.stat().st_mtime) / 3600)
        except OSError:
            return "?"

    out: list[str] = []
    for label, p in [("CONTEXT.md", ROOT / "CONTEXT.md"),
                     ("LEARNINGS.md", ROOT / "LEARNINGS.md"),
                     ("HANDOVER.md", ROOT / "HANDOVER.md")]:
        if label == "LEARNINGS.md" and not p.exists():
            p = ROOT / "docs" / "LEARNINGS.md"
        out.append(f"{label} {age(p)}" if p.exists() else f"{label} missing")
    adr_dir = ROOT / "docs" / "adr"
    adrs = sorted(adr_dir.glob("*.md"), key=lambda q: q.stat().st_mtime,
                  reverse=True) if adr_dir.is_dir() else []
    out.append(f"newest ADR {age(adrs[0])}" if adrs else "ADRs none")
    return out


def derive_recent_activity() -> list[dict]:
    raw = git("log", "-8", "--format=%h\t%s\t%ar\t%an")
    out = []
    for line in raw.splitlines():
        parts = line.split("\t")
        if len(parts) >= 3:
            out.append({"hash": parts[0], "subject": parts[1],
                        "when": parts[2], "who": parts[3] if len(parts) > 3 else ""})
    return out


def derive_directory_edges(dir_map: list[dict], canonical: list[dict]) -> list[dict]:
    """Lightweight edges between top-level directories.

    Rule 1: if a `scripts` directory exists, link it to every dir that owns a
    canonical artifact (scripts produce canonical things).
    Rule 2: link any directory whose name appears as a substring in another
    directory's filenames (catches e.g. strain_analysis ↔ strain_analysis_sanity
    pairings).
    Rule 3: cap fan-out at 4 edges per node so the graph stays readable."""
    names = [d["name"] for d in dir_map]
    name_set = set(names)
    edges: set[tuple[str, str]] = set()

    # Rule 1: scripts → canonical-owning dirs
    if "scripts" in name_set:
        for c in canonical:
            p = c.get("path_primary") or c.get("path", "")
            if not p or p.startswith(("../", "/", "http")):
                continue
            top = p.split("/", 1)[0]
            if top in name_set and top != "scripts":
                a, b = sorted(("scripts", top))
                edges.add((a, b))

    # Rule 2: name-substring pairs (same prefix → likely related)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if a in b or b in a:
                ea, eb = sorted((a, b))
                edges.add((ea, eb))

    # Rule 3: cap fan-out per node
    fan: Counter = Counter()
    keep: list[tuple[str, str]] = []
    for a, b in sorted(edges):
        if fan[a] >= 4 or fan[b] >= 4:
            continue
        keep.append((a, b))
        fan[a] += 1
        fan[b] += 1
    return [{"a": a, "b": b} for a, b in keep]


def derive_directory_map() -> list[dict]:
    """Top-level directories of the repo, with file count, dominant kind, last
    modified time, and a colour by inferred role. This is the always-on at-a-
    glance map; the curated force-directed INDEX.html (if present) is a richer
    layer on top of it."""
    EXT_KIND = {
        ".py": "code", ".ts": "code", ".js": "code", ".tsx": "code", ".jsx": "code",
        ".sh": "code", ".rs": "code", ".go": "code", ".swift": "code", ".kt": "code",
        ".java": "code", ".c": "code", ".cpp": "code", ".h": "code", ".hpp": "code",
        ".r": "code", ".rmd": "code",
        ".md": "docs", ".rst": "docs", ".txt": "docs", ".pdf": "docs",
        ".docx": "docs", ".html": "docs",
        ".csv": "data", ".tsv": "data", ".json": "data", ".yaml": "data",
        ".yml": "data", ".parquet": "data", ".xlsx": "data", ".xls": "data",
        ".fasta": "data", ".fastq": "data", ".vcf": "data", ".bed": "data",
        ".png": "figs", ".jpg": "figs", ".jpeg": "figs", ".svg": "figs",
        ".pdf": "docs",   # pdfs lean documentary; figs win if dir is mostly figs
    }
    KIND_COLOR = {
        "code": PALETTE["air"],
        "docs": PALETTE["thesis"],
        "data": PALETTE["water"],
        "figs": "#7E57C2",
        "mixed": PALETTE["muted"],
    }
    SKIP_DIRS = {".git", "node_modules", "DerivedData", "__pycache__",
                 ".matplotlib-cache", ".venv", "venv", ".pytest_cache",
                 ".mypy_cache", "dist", "build", ".next"}
    by_top: dict[str, list[Path]] = {}
    for p in repo_files():
        rel = p.relative_to(ROOT)
        if len(rel.parts) < 2:
            continue   # top-level file, not a directory bucket
        top = rel.parts[0]
        if top in SKIP_DIRS or top.startswith("."):
            continue
        if any(seg in rel.parts[1:] for seg in SKIP_DIRS):
            continue
        by_top.setdefault(top, []).append(p)
    items: list[dict] = []
    for name in sorted(by_top, key=str.lower):
        kind_counts: Counter = Counter()
        n_files = 0
        latest_mtime = 0.0
        for sub in by_top[name]:
            n_files += 1
            kind_counts[EXT_KIND.get(sub.suffix.lower(), "mixed")] += 1
            try:
                m = sub.stat().st_mtime
                if m > latest_mtime:
                    latest_mtime = m
            except OSError:
                pass
        # dominant kind = most common, falling back to mixed if no plurality
        top = kind_counts.most_common(1)[0] if kind_counts else ("mixed", 0)
        kind = top[0] if top[1] >= n_files * 0.5 else "mixed"
        age = (fmt_age((datetime.now(timezone.utc).timestamp() - latest_mtime) / 3600)
               if latest_mtime else "")
        items.append({
            "name": name,
            "count": n_files,
            "kind": kind,
            "age": age,
            "color": KIND_COLOR.get(kind, KIND_COLOR["mixed"]),
            "mtime": latest_mtime,
        })
    # sort by recency so freshest dirs sit first
    items.sort(key=lambda d: -d["mtime"])
    return items


def derive_health(canonical: list[dict], loose: dict) -> list[dict]:
    """Cockpit row: small set of green/amber/red dots."""
    out: list[dict] = []
    out.append({"label": "README", "state": "ok" if README.exists() else "warn"})
    out.append({"label": "CLAUDE.md", "state": "ok" if CLAUDE_MD.exists() else "warn"})
    out.append({"label": "CONTEXT.md", "state": "ok" if CONTEXT.exists() else "warn"})
    if loose["uncommitted"]:
        out.append({"label": f"git: {len(loose['uncommitted'])} dirty", "state": "warn"})
    else:
        out.append({"label": "git clean", "state": "ok"})
    # unpushed: 0 → ok; >0 → warn; no upstream → dim
    upstream = git("rev-parse", "--abbrev-ref", "@{u}")
    if not upstream:
        out.append({"label": "no upstream", "state": "dim"})
    elif loose["unpushed"]:
        out.append({"label": f"unpushed {len(loose['unpushed'])}", "state": "warn"})
    else:
        out.append({"label": "remote synced", "state": "ok"})
    out.append({"label": f"scripts/ ({len(list(SCRIPTS_DIR.iterdir())) if SCRIPTS_DIR.is_dir() else 0})",
                "state": "ok" if SCRIPTS_DIR.is_dir() else "warn"})
    # canonical links live?
    missing = sum(1 for c in canonical if c.get("exists") is False)
    if missing:
        out.append({"label": f"{missing} canonical missing", "state": "warn"})
    else:
        out.append({"label": "canonical OK", "state": "ok"})
    return out


# --- rendering ------------------------------------------------------------

def render_waves_svg(waves: list[dict]) -> str:
    if not waves:
        return '<p class="empty">no waves detected</p>'
    n = len(waves)
    width = 1080
    margin = 60
    spacing = (width - 2 * margin) / max(1, n - 1) if n > 1 else 0
    parts = [
        f'<svg viewBox="0 0 {width} 150" xmlns="http://www.w3.org/2000/svg" '
        f'preserveAspectRatio="xMinYMin meet" '
        f'style="font-family:\'JetBrains Mono\',\'SF Mono\',Menlo,monospace;">',
        f'<line x1="40" y1="65" x2="{width - 40}" y2="65" stroke="#D5D5D5" stroke-width="1"/>',
    ]
    for i, w in enumerate(waves):
        x = margin + spacing * i if n > 1 else width / 2
        color = w.get("color", PALETTE["thesis"])
        r = 24 if i == n - 1 else 19
        parts.append(f'<text x="{x:.0f}" y="33" text-anchor="middle" font-size="11" '
                     f'fill="#6B6B6B">{esc(str(w.get("sub", ""))[:22])}</text>')
        parts.append(f'<circle cx="{x:.0f}" cy="65" r="{r}" fill="{color}"/>')
        parts.append(f'<text x="{x:.0f}" y="70" text-anchor="middle" fill="white" '
                     f'font-size="12" font-weight="700">{esc(w["label"])}</text>')
        if w.get("count"):
            parts.append(f'<text x="{x:.0f}" y="113" text-anchor="middle" '
                         f'font-size="10.5" fill="#6B6B6B">{w["count"]} commits</text>')
    parts.append('</svg>')
    return "\n".join(parts)


def render_hero(data: dict) -> str:
    status = data["status"]
    return f"""
  <header class="hero" style="--accent:{status['color']}">
    <div class="hero-main">
      <p class="eyebrow">Dashboard for {esc(data['project'])}</p>
      <h1>{esc(data['project'])}</h1>
      <p class="oneliner">{esc(data['oneliner']) or '<em>(no one-liner — add `oneliner:` to docs/hub.yaml or a `## :oneline` section to HUB.md)</em>'}</p>
      <p class="status-line">
        <span class="pill" style="background:{status['color']}">{esc(status['pill'])}</span>
        <span class="reason mono">{esc(status['reason'])}</span>
      </p>
      <p class="next mono"><span class="next-tag">NEXT →</span> {esc(data['next_action'])}</p>
    </div>
    <div class="hero-meta mono">
      <div>branch <strong>{esc(data['branch'])}</strong></div>
      <div>{datetime.now().strftime('%Y-%m-%d %H:%M')}</div>
      <div class="dim">scripts/build_hub.py</div>
    </div>
  </header>
"""


def render_health(items: list[dict]) -> str:
    if not items:
        return ""
    parts = ['<div class="health-row mono">']
    for it in items:
        state = it["state"]
        glyph = {"ok": "●", "warn": "◐", "fail": "✕", "dim": "○"}[state]
        parts.append(
            f'<span class="health-cell health-{state}">{glyph}&nbsp;{esc(it["label"])}</span>'
        )
    parts.append("</div>")
    return "".join(parts)


def render_guardrails(items: list[dict]) -> str:
    """Render the Guardrails section. Always rendered (empty-state covers
    repos with no auto-detected safety nets)."""
    def _path_link(path: str) -> str:
        # Strip optional `#anchor` and link the file in VS Code.
        file_part = path.split("#", 1)[0] if "#" in path else path
        return f'<a href="{esc(vscode_link(file_part))}">{esc(path)}</a>'

    if items:
        cards = "".join(
            f'<div class="guardrail-card k-{esc(g.get("kind", "block"))}">'
            f'<div class="title">{esc(g["name"])}</div>'
            f'<div class="path mono">{_path_link(g["path"])}</div>'
            f'<div class="protects">{esc(g.get("protects", ""))}</div>'
            f'<div class="when mono">{esc(g.get("when", ""))}</div>'
            f'</div>'
            for g in items
        )
        body = f'<div class="guardrail-grid">{cards}</div>'
    else:
        body = ('<p class="empty">No guardrails auto-detected. Common patterns: '
                '<code>.husky/*</code>, <code>.github/workflows/*</code>, '
                '<code>scripts/check-*.sh</code>, policy tests like '
                '<code>rls.test.ts</code>, and a NEVER/ALWAYS section in '
                '<code>CLAUDE.md</code>. Add curated ones via '
                '<code>hub.yaml</code> → <code>guardrails:</code> or a '
                '<code>## :guardrails</code> table in <code>HUB.md</code>.</p>')

    return f"""
  <section id="guardrails">
    {section_heading("guardrails")}
    <div class="guardrail-legend mono">
      <span><span class="dot" style="background:#C25A1D"></span>Blocks the action</span>
      <span><span class="dot" style="background:var(--air)"></span>Test catches it</span>
      <span><span class="dot" style="background:var(--water)"></span>Rules &amp; runbooks</span>
      <span><span class="dot" style="background:var(--dim)"></span>Configuration</span>
    </div>
    {body}
  </section>
"""


def render_pickup(cp: dict | None) -> str:
    if not cp:
        return ""
    stale_note = (f'\n        <span class="dim" style="color: {PALETTE["warn"]};">'
                  f'· ⚠ {cp["commits_since"]} commits since — may be stale</span>'
                  if cp.get("stale") else "")
    return f"""
  <section id="pickup">
    {section_heading("pickup")}
    <div class="pickup-card">
      <div class="pickup-src mono">from <a href="{esc(vscode_link(cp['path']))}">{esc(cp['path'])}</a>
        <span class="dim">· modified {esc(cp['age'])}</span>{stale_note}</div>
      <p class="pickup-text">{esc(cp['snippet'])}</p>
    </div>
  </section>
"""


def render_inline_graph(dir_map: list[dict], edges: list[dict]) -> str:
    """Return a self-contained HTML+CSS+JS snippet embedding a force-directed
    directory graph. Scoped under .auto-graph-wrap; no external libraries."""
    payload = {"nodes": dir_map, "edges": edges}
    # Escape `</` so the JSON cannot terminate the surrounding <script> tag.
    payload_json = json.dumps(payload, ensure_ascii=False, default=str).replace("</", "<\\/")

    return f"""<div class="auto-graph-wrap">
<style>
  .auto-graph-wrap {{ position: relative; width: 100%; height: 720px;
    border: 1px solid rgba(17,24,39,0.08); border-radius: 10px;
    background: radial-gradient(ellipse at center, #fff 0%, #fafafa 70%);
    overflow: hidden; font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
    color: #111827; }}
  .auto-graph-wrap svg {{ width: 100%; height: 100%; cursor: grab;
    user-select: none; display: block; }}
  .auto-graph-wrap svg.dragging {{ cursor: grabbing; }}
  .auto-graph-wrap .edge {{ stroke: rgba(17,24,39,0.18); stroke-width: 1; fill: none; }}
  .auto-graph-wrap .edge.hi {{ stroke: #f59e0b; stroke-width: 2; }}
  .auto-graph-wrap .node circle {{ stroke: white; stroke-width: 2; cursor: pointer; }}
  .auto-graph-wrap .node.selected circle {{ stroke: #316D33; stroke-width: 3; }}
  .auto-graph-wrap .node.dim {{ opacity: 0.18; }}
  .auto-graph-wrap .node text {{ font: 11px "JetBrains Mono", ui-monospace, monospace;
    pointer-events: none; fill: #111827; text-anchor: middle;
    dominant-baseline: hanging; paint-order: stroke;
    stroke: white; stroke-width: 3; }}
  .auto-graph-wrap .ag-legend {{ position: absolute; top: 14px; right: 14px; z-index: 5;
    background: #fff; border: 1px solid rgba(17,24,39,0.08); border-radius: 8px;
    padding: 8px 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); font-size: 12px; }}
  .auto-graph-wrap .ag-legend .row {{ display: flex; align-items: center; gap: 8px; padding: 2px 0; }}
  .auto-graph-wrap .ag-legend .dot {{ width: 10px; height: 10px; border-radius: 50%; }}
  .auto-graph-wrap .ag-info {{ position: absolute; top: 120px; right: 14px; z-index: 5;
    width: 260px; background: #fff; border: 1px solid rgba(17,24,39,0.08);
    border-radius: 8px; padding: 12px 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.06);
    font-size: 12px; display: none; }}
  .auto-graph-wrap .ag-info.show {{ display: block; }}
  .auto-graph-wrap .ag-info h3 {{ margin: 0 0 4px; font-size: 14px;
    font-family: "JetBrains Mono", ui-monospace, monospace; word-break: break-all; }}
  .auto-graph-wrap .ag-info .badge {{ display: inline-block; padding: 2px 8px;
    border-radius: 999px; font-size: 11px; color: white; margin-bottom: 8px; }}
  .auto-graph-wrap .ag-info .meta {{ color: #6b7280; margin: 0 0 8px; }}
  .auto-graph-wrap .ag-info h4 {{ margin: 10px 0 4px; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }}
  .auto-graph-wrap .ag-info .links a {{ display: inline-block; padding: 3px 8px;
    margin: 2px 4px 2px 0; background: rgba(37,99,235,0.08); color: #2563EB;
    border-radius: 6px; cursor: pointer; text-decoration: none;
    font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; }}
  .auto-graph-wrap .ag-info .links a:hover {{ background: rgba(37,99,235,0.16); }}
  .auto-graph-wrap .ag-info .empty {{ color: #6b7280; font-style: italic; }}
</style>
<div class="ag-legend"></div>
<div class="ag-info"></div>
<svg viewBox="0 0 1200 720" preserveAspectRatio="xMidYMid meet"></svg>
<script>
(function() {{
  const DATA = {payload_json};
  const WRAP = document.currentScript.parentElement;
  const SVG = WRAP.querySelector("svg");
  const LEGEND = WRAP.querySelector(".ag-legend");
  const INFO = WRAP.querySelector(".ag-info");
  const VBW = 1200, VBH = 720;

  function escapeHtml(s) {{
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}})[c]);
  }}

  const kinds = [];
  const kindColor = {{}};
  for (const n of DATA.nodes) {{
    if (!(n.kind in kindColor)) {{ kinds.push(n.kind); kindColor[n.kind] = n.color; }}
  }}
  for (const k of kinds) {{
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span class="dot" style="background:${{kindColor[k]}}"></span>${{escapeHtml(k)}}`;
    LEGEND.appendChild(row);
  }}

  const groupCentroids = {{}};
  kinds.forEach((k, i) => {{
    const angle = (i / Math.max(1, kinds.length)) * Math.PI * 2;
    groupCentroids[k] = {{ x: Math.cos(angle) * 0.30, y: Math.sin(angle) * 0.30 }};
  }});

  const nodes = DATA.nodes.map(n => {{
    const c = groupCentroids[n.kind] || {{ x: 0, y: 0 }};
    return {{
      name: n.name, count: n.count, kind: n.kind, age: n.age, color: n.color,
      radius: 9 + Math.sqrt(n.count) * 3,
      x: c.x + (Math.random() - 0.5) * 0.12,
      y: c.y + (Math.random() - 0.5) * 0.12,
      vx: 0, vy: 0, fx: null, fy: null,
    }};
  }});
  const idx = Object.fromEntries(nodes.map((n, i) => [n.name, i]));

  const seen = new Set();
  const edges = [];
  for (const e of DATA.edges) {{
    if (!(e.a in idx) || !(e.b in idx)) continue;
    const key = e.a < e.b ? e.a + "\\u0001" + e.b : e.b + "\\u0001" + e.a;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({{ source: idx[e.a], target: idx[e.b] }});
  }}

  const adj = {{}};
  for (const n of nodes) adj[n.name] = new Set();
  for (const e of edges) {{
    adj[nodes[e.source].name].add(nodes[e.target].name);
    adj[nodes[e.target].name].add(nodes[e.source].name);
  }}

  const REPULSION = 0.00045, SPRING_K = 0.020, SPRING_LEN = 0.20;
  const GRAVITY = 0.012, GROUP_PULL = 0.022, DAMPING = 0.86;

  function tick() {{
    for (const n of nodes) {{
      if (n.fx !== null) {{ n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0; continue; }}
      let ax = 0, ay = 0;
      for (const m of nodes) {{
        if (m === n) continue;
        const dx = n.x - m.x, dy = n.y - m.y;
        const d2 = dx*dx + dy*dy + 0.0001;
        const f = REPULSION / d2;
        ax += dx * f; ay += dy * f;
      }}
      ax += -n.x * GRAVITY; ay += -n.y * GRAVITY;
      const c = groupCentroids[n.kind];
      if (c) {{ ax += (c.x - n.x) * GROUP_PULL; ay += (c.y - n.y) * GROUP_PULL; }}
      n.vx = (n.vx + ax) * DAMPING;
      n.vy = (n.vy + ay) * DAMPING;
      n.x += n.vx; n.y += n.vy;
    }}
    for (const e of edges) {{
      const a = nodes[e.source], b = nodes[e.target];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx*dx + dy*dy) + 0.0001;
      const delta = (dist - SPRING_LEN) * SPRING_K;
      const fx = (dx / dist) * delta, fy = (dy / dist) * delta;
      if (a.fx === null) {{ a.vx += fx; a.vy += fy; a.x += fx; a.y += fy; }}
      if (b.fx === null) {{ b.vx -= fx; b.vy -= fy; b.x -= fx; b.y -= fy; }}
    }}
  }}

  for (let i = 0; i < 400; i++) tick();

  const ns = "http://www.w3.org/2000/svg";
  let viewScale = 1.0, viewX = 0, viewY = 0;
  const gRoot = document.createElementNS(ns, "g");
  const gEdges = document.createElementNS(ns, "g");
  const gNodes = document.createElementNS(ns, "g");
  gRoot.appendChild(gEdges); gRoot.appendChild(gNodes);
  SVG.appendChild(gRoot);

  const edgeEls = edges.map(() => {{
    const ln = document.createElementNS(ns, "line");
    ln.setAttribute("class", "edge");
    gEdges.appendChild(ln);
    return ln;
  }});

  const nodeEls = nodes.map(n => {{
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", "node");
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("r", n.radius);
    c.setAttribute("fill", n.color);
    const t = document.createElementNS(ns, "text");
    t.setAttribute("y", n.radius + 4);
    t.textContent = n.name + "/";
    g.appendChild(c); g.appendChild(t);
    gNodes.appendChild(g);
    g.addEventListener("click", ev => {{ ev.stopPropagation(); select(n.name); }});
    g.addEventListener("pointerdown", ev => {{
      ev.stopPropagation();
      const p = toWorld(ev.clientX, ev.clientY);
      n.fx = p.x; n.fy = p.y;
      g.setPointerCapture(ev.pointerId);
      const move = mv => {{ const q = toWorld(mv.clientX, mv.clientY); n.fx = q.x; n.fy = q.y; }};
      const up = () => {{
        try {{ g.releasePointerCapture(ev.pointerId); }} catch (e) {{}}
        g.removeEventListener("pointermove", move);
        g.removeEventListener("pointerup", up);
        setTimeout(() => {{ n.fx = null; n.fy = null; }}, 600);
      }};
      g.addEventListener("pointermove", move);
      g.addEventListener("pointerup", up);
    }});
    return g;
  }});

  function worldToScreen() {{
    const scale = Math.min(VBW, VBH) * 0.9 * viewScale;
    const cx = VBW / 2 + viewX, cy = VBH / 2 + viewY;
    return {{ scale, cx, cy }};
  }}
  function toWorld(sx, sy) {{
    const r = SVG.getBoundingClientRect();
    const ux = (sx - r.left) * (VBW / r.width);
    const uy = (sy - r.top) * (VBH / r.height);
    const {{ scale, cx, cy }} = worldToScreen();
    return {{ x: (ux - cx) / scale, y: (uy - cy) / scale }};
  }}
  function render() {{
    const {{ scale, cx, cy }} = worldToScreen();
    for (let i = 0; i < edges.length; i++) {{
      const e = edges[i], a = nodes[e.source], b = nodes[e.target], ln = edgeEls[i];
      ln.setAttribute("x1", cx + a.x * scale);
      ln.setAttribute("y1", cy + a.y * scale);
      ln.setAttribute("x2", cx + b.x * scale);
      ln.setAttribute("y2", cy + b.y * scale);
    }}
    for (let i = 0; i < nodes.length; i++) {{
      const n = nodes[i];
      nodeEls[i].setAttribute("transform", `translate(${{cx + n.x * scale}}, ${{cy + n.y * scale}})`);
    }}
  }}
  function loop() {{ tick(); render(); requestAnimationFrame(loop); }}
  loop();

  let panning = false, panStart = null;
  SVG.addEventListener("pointerdown", ev => {{
    if (ev.target.closest(".node")) return;
    panning = true;
    panStart = {{ x: ev.clientX, y: ev.clientY, vx: viewX, vy: viewY, r: SVG.getBoundingClientRect() }};
    SVG.classList.add("dragging");
    SVG.setPointerCapture(ev.pointerId);
  }});
  SVG.addEventListener("pointermove", ev => {{
    if (!panning) return;
    const sx = (ev.clientX - panStart.x) * (VBW / panStart.r.width);
    const sy = (ev.clientY - panStart.y) * (VBH / panStart.r.height);
    viewX = panStart.vx + sx; viewY = panStart.vy + sy;
  }});
  SVG.addEventListener("pointerup", ev => {{
    panning = false; SVG.classList.remove("dragging");
    try {{ SVG.releasePointerCapture(ev.pointerId); }} catch (e) {{}}
  }});
  SVG.addEventListener("wheel", ev => {{
    ev.preventDefault();
    const factor = Math.exp(-ev.deltaY * 0.001);
    viewScale = Math.max(0.3, Math.min(4, viewScale * factor));
  }}, {{ passive: false }});
  SVG.addEventListener("click", ev => {{
    if (ev.target.closest(".node")) return;
    clearSelection();
  }});

  function clearSelection() {{
    for (const el of nodeEls) {{ el.classList.remove("selected"); el.classList.remove("dim"); }}
    for (const el of edgeEls) el.classList.remove("hi");
    INFO.classList.remove("show");
  }}
  function select(name) {{
    const neigh = new Set([name, ...adj[name]]);
    for (let i = 0; i < nodes.length; i++) {{
      nodeEls[i].classList.toggle("selected", nodes[i].name === name);
      nodeEls[i].classList.toggle("dim", !neigh.has(nodes[i].name));
    }}
    for (let i = 0; i < edges.length; i++) {{
      const e = edges[i];
      const hot = nodes[e.source].name === name || nodes[e.target].name === name;
      edgeEls[i].classList.toggle("hi", hot);
    }}
    const n = nodes[idx[name]];
    const linked = [...adj[name]];
    const linkHtml = linked.length
      ? `<div class="links">${{linked.map(x => `<a data-jump="${{escapeHtml(x)}}">${{escapeHtml(x)}}/</a>`).join("")}}</div>`
      : `<p class="empty">No linked dirs.</p>`;
    INFO.innerHTML = `
      <h3>${{escapeHtml(n.name)}}/</h3>
      <span class="badge" style="background:${{n.color}}">${{escapeHtml(n.kind)}}</span>
      <p class="meta">${{n.count}} file${{n.count === 1 ? "" : "s"}} &middot; ${{escapeHtml(n.age)}}</p>
      <h4>Linked dirs (${{linked.length}})</h4>
      ${{linkHtml}}
    `;
    INFO.classList.add("show");
    INFO.querySelectorAll("a[data-jump]").forEach(a =>
      a.addEventListener("click", ev => {{ ev.preventDefault(); select(a.dataset.jump); }}));
  }}
}})();
</script>
</div>"""


def render_directory_map(items: list[dict]) -> str:
    """Always-on at-a-glance map of top-level directories. Replaces the dead
    'no graph' state when no curated INDEX.html exists; pairs with it when it
    does."""
    if not items:
        return '<p class="empty">No subdirectories at repo root.</p>'
    KIND_LABEL = {
        "code": "code",
        "docs": "docs",
        "data": "data",
        "figs": "figures",
        "mixed": "mixed",
    }
    tiles = []
    for d in items:
        tiles.append(
            f'<div class="dir-tile" style="--tile-accent:{d["color"]}">'
            f'<div class="dir-tile-name mono">{esc(d["name"])}/</div>'
            f'<div class="dir-tile-stats">'
            f'<span class="dir-tile-kind">{esc(KIND_LABEL.get(d["kind"], d["kind"]))}</span>'
            f'<span class="dir-tile-count mono">{d["count"]} file{"s" if d["count"] != 1 else ""}</span>'
            f'</div>'
            f'<div class="dir-tile-age mono">touched {esc(d["age"])}</div>'
            f'</div>'
        )
    return f'<div class="dir-grid">{"".join(tiles)}</div>'


def render_loose_ends(loose: dict) -> str:
    def _panel(title: str, blurb: str, count: int, body: str, color_var: str) -> str:
        head = (f'<div class="loose-head mono">{esc(title)} '
                f'<span class="loose-count" style="color:{color_var}">{count}</span></div>')
        sub = f'<p class="loose-sub">{esc(blurb)}</p>'
        return f'<div class="loose-panel">{head}{sub}{body}</div>'

    # uncommitted
    if loose["uncommitted"]:
        uc_rows = "".join(
            f'<li><code class="loose-status">{esc(u["status"])}</code> '
            f'<a href="{esc(vscode_link(u["path"]))}">{esc(u["path"])}</a></li>'
            for u in loose["uncommitted"][:6]
        )
        extra = f'<li class="more">… +{len(loose["uncommitted"]) - 6} more</li>' if len(loose["uncommitted"]) > 6 else ""
        uc_body = f'<ul class="loose-list">{uc_rows}{extra}</ul>'
    else:
        uc_body = '<p class="empty">clean</p>'
    p1 = _panel("UNCOMMITTED",
                "Files you changed but haven't committed yet. Finish them or roll them back before you forget.",
                len(loose["uncommitted"]), uc_body,
                PALETTE["warn"] if loose["uncommitted"] else PALETTE["ok"])

    # unpushed
    if loose["unpushed"]:
        up_rows = "".join(
            f'<li><code>{esc(u["hash"])}</code> {esc(u["subject"])} '
            f'<span class="dim">· {esc(u["when"])}</span></li>'
            for u in loose["unpushed"][:6]
        )
        up_body = f'<ul class="loose-list">{up_rows}</ul>'
    else:
        up_body = '<p class="empty">remote synced</p>'
    p2 = _panel("UNPUSHED",
                "Commits sitting on your laptop that haven't reached the remote. A `git push` away from being shared.",
                len(loose["unpushed"]), up_body,
                PALETTE["warn"] if loose["unpushed"] else PALETTE["ok"])

    # todos
    if loose["todos"]:
        td_rows = "".join(
            f'<li><a href="{esc(vscode_link(t["path"]))}"><code>{esc(t["path"])}:{t["line"]}</code></a> '
            f'<span class="todo-text">{esc(t["text"])}</span></li>'
            for t in loose["todos"][:6]
        )
        extra = f'<li class="more">… +{len(loose["todos"]) - 6} more</li>' if len(loose["todos"]) > 6 else ""
        td_body = f'<ul class="loose-list">{td_rows}{extra}</ul>'
    else:
        td_body = '<p class="empty">none</p>'
    p3 = _panel("TODO / FIXME",
                "Notes you (or someone) left in the code for later. Each one is a small unfinished thing.",
                len(loose["todos"]), td_body,
                PALETTE["warn"] if loose["todos"] else PALETTE["ok"])

    # drafts
    if loose["drafts"]:
        dr_rows = "".join(
            f'<li><a href="{esc(vscode_link(d["path"]))}">{esc(d["path"])}</a> '
            f'<span class="dim">· {esc(d["when"])}</span></li>'
            for d in loose["drafts"][:6]
        )
        dr_body = f'<ul class="loose-list">{dr_rows}</ul>'
    else:
        dr_body = '<p class="empty">none recent</p>'
    p4 = _panel("DRAFTS (7d)",
                "Files whose name contains 'draft', 'wip', or 'scratch' and were touched in the last week. Likely in-progress.",
                len(loose["drafts"]), dr_body,
                PALETTE["warn"] if loose["drafts"] else PALETTE["ok"])

    return f"""
  <section id="loose_ends">
    {section_heading("loose_ends")}
    <div class="loose-grid">{p1}{p2}{p3}{p4}</div>
  </section>
"""


def render_status_section(curated: dict, status: dict) -> str:
    body_html: str
    if "status" in curated:
        body_html = md_to_html(curated["status"])
    else:
        reason_suffix = f" — {esc(status['reason'])}" if status.get("reason") else ""
        body_html = (
            f"<p>The project is currently <strong>{esc(status['pill'])}</strong>{reason_suffix}.</p>"
            "<p style=\"margin-top:14px\">From here you can:</p>"
            "<ul class=\"touch-list\">"
            "<li>See which files hold the current source of truth → "
            "<a href=\"#canonical\">Important files</a></li>"
            "<li>Look up project-specific words → "
            "<a href=\"#concepts\">Glossary</a></li>"
            "<li>Run a script to refresh something → "
            "<a href=\"#scripts\">Scripts</a></li>"
            "<li>Read why decisions were made → "
            "<a href=\"#decisions\">Decisions</a></li>"
            "<li>See what's been retired → "
            "<a href=\"#superseded\">Archived</a></li>"
            "</ul>"
        )
    return f"""
  <section id="status">
    {section_heading("status")}
    <div class="prose">{body_html}</div>
  </section>
"""


def render(data: dict) -> str:
    p = PALETTE
    waves_svg = render_waves_svg(data["waves"])
    waves_table = (f'<div class="prose waves-table">{md_to_html(data["curated"]["waves"])}</div>'
                   if "waves" in data["curated"] else "")

    def cards(items: list[str]) -> str:
        return '<div class="grid">' + "".join(items) + '</div>'

    def _canonical_card(c: dict) -> str:
        primary = c.get("path_primary") or c["path"]
        # if the original cell had multiple paths, show the extras as a sub-line
        # — compare with trailing slashes stripped so "foo/" doesn't count
        # as different from "foo"
        original = str(c["path"]).strip()
        all_backticked = re.findall(r"`([^`]+)`", original)
        prim_norm = primary.rstrip("/")
        extras = [b for b in all_backticked if b.rstrip("/") != prim_norm] if all_backticked else []
        extras_html = (f'<div class="extras mono">also: {", ".join(esc(e) for e in extras)}</div>'
                       if extras else "")
        age_or_missing = ""
        if "exists" in c:
            if c["exists"] is False:
                age_or_missing = '<span class="missing">missing on disk</span>'
            elif c.get("age") == "external":
                age_or_missing = '<span class="external">external reference</span>'
            elif c.get("age"):
                age_or_missing = f'modified {esc(c["age"])}'
        return (f'<div class="card">'
                f'<div class="id">:{esc(c["name"])}</div>'
                f'<div class="path"><a href="{esc(vscode_link(primary))}">{esc(primary)}</a></div>'
                f'{extras_html}'
                + (f'<div class="meta-line mono">{age_or_missing}</div>' if age_or_missing else "")
                + f'<div class="desc">{md_inline(c.get("desc", ""))}</div>'
                '</div>')

    canonical_cards = "".join(_canonical_card(c) for c in data["canonical"]) \
        or '<p class="empty">No canonical artifacts inferred. Curate `## :canonical` in HUB.md or add canonical_refs: to docs/hub.yaml.</p>'

    concept_cards = "".join(
        f'<div class="card"><div class="id cn">:{esc(c["name"])}</div>'
        f'<div class="desc">{md_inline(c["desc"])}</div></div>'
        for c in data["concepts"]
    ) or '<p class="empty">No concepts detected.</p>'

    script_cards = "".join(
        f'<div class="card"><div class="id sc">:{esc(s["name"])}</div>'
        f'<div class="path">{esc(s["path"])}</div></div>'
        for s in data["scripts"]
    ) or '<p class="empty">No runnable entry points found.</p>'

    collab_cards = "".join(
        f'<div class="card"><div class="id pp">:{esc(c["name"])}</div>'
        f'<div class="desc">{md_inline(str(c.get("count", "")))}</div></div>'
        for c in data["collaborators"]
    ) or '<p class="empty">No contributors.</p>'

    decision_list = "".join(
        f'<li><a href="{esc(vscode_link(d["path"]))}"><code>{esc(d["path"])}</code></a> '
        f'<span class="note">— {esc(d["title"])}</span></li>'
        for d in data["decisions"]
    ) or '<li class="empty">No ADRs in docs/adr/.</li>'

    plan_list = "".join(
        f'<li><a href="{esc(vscode_link(d["path"]))}"><code>{esc(d["path"])}</code></a> '
        f'<span class="note">— {esc(d["title"])}</span></li>'
        for d in data["plans"]
    ) or '<li class="empty">No plans in docs/plans/.</li>'

    if data["superseded"]["curated_md"]:
        superseded_block = f'<div class="prose">{md_to_html(data["superseded"]["curated_md"])}</div>'
    else:
        sup_items = "".join(
            f'<li><code>{esc(s["path"])}/</code> <span class="note">— in <code>{esc(s["parent"])}/</code></span></li>'
            for s in data["superseded"]["items"]
        ) or '<li class="empty">Nothing matched common superseded patterns.</li>'
        superseded_block = f'<ul class="doc-list">{sup_items}</ul>'

    activity_list = "".join(
        f'<li><code>{esc(a["hash"])}</code> {esc(a["subject"])} '
        f'<span class="note">({esc(a["when"])}{(" · " + esc(a["who"])) if a.get("who") and len(data["collaborators"]) > 1 else ""})</span></li>'
        for a in data["recent_activity"]
    )

    index_html_present = INDEX_HTML_DOCS.exists() or INDEX_HTML_ROOT.exists()
    # Resolve the iframe src RELATIVE to HUB.html's actual write location, not
    # to repo root. Otherwise an HUB.html at `docs/HUB.html` ends up pointing
    # the iframe at `docs/docs/INDEX.html` (404 in browsers, including Firefox
    # over file://).
    _index_target = INDEX_HTML_DOCS if INDEX_HTML_DOCS.exists() else INDEX_HTML_ROOT
    _out_path = find_output(data["_overrides"])
    index_html_path = os.path.relpath(_index_target, _out_path.parent)
    index_link = (f'<a href="#graph" class="cta">Code map ↓</a>'
                  if index_html_present else "")

    dir_map_html = render_directory_map(data["directory_map"])
    map_section = f"""
  <section id="map">
    {section_heading("map")}
    {dir_map_html}
  </section>
"""

    if index_html_present:
        graph_extra = (f' Showing the curated <code>{index_html_path}</code> view — '
                       f'open full screen for more room.')
        graph_body = f"""    <div class="graph-embed">
      <a href="{index_html_path}" target="_blank" class="open-full">open full screen ↗</a>
      <iframe src="{index_html_path}" title="Code map" loading="lazy" referrerpolicy="no-referrer"></iframe>
    </div>"""
        graph_section = f"""
<section id="graph" class="fullwidth">
{section_heading("graph", extra_hint=graph_extra)}
{graph_body}
</section>
"""
    else:
        # No curated INDEX.html — render the inline auto-derived force-directed
        # graph instead. Same data source as :map (top-level directories), plus
        # the lightweight inferred edges from derive_directory_edges.
        inline_graph_html = render_inline_graph(
            data["directory_map"], data["directory_edges"]
        )
        graph_extra = (" Install the curated <code>docs/INDEX.html</code> layer "
                       "for a richer file-level view.")
        graph_section = f"""
<section id="graph" class="fullwidth">
{section_heading("graph", extra_hint=graph_extra)}
    {inline_graph_html}
</section>
"""

    hero_html = render_hero(data)
    health_html = render_health(data["health"])
    pickup_html = render_pickup(data["checkpoint"])
    loose_html = render_loose_ends(data["loose"])
    status_html = render_status_section(data["curated"], data["status"])
    guardrails_html = render_guardrails(data["guardrails"])

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(data['project'])} · project hub</title>
<style>
  :root {{
    --air: {p['air']}; --water: {p['water']}; --thesis: {p['thesis']};
    --bg: {p['bg']}; --bg-soft: {p['bg_soft']};
    --ink: {p['ink']}; --muted: {p['muted']};
    --border: {p['border']}; --border-2: {p['border_2']};
    --ok: {p['ok']}; --warn: {p['warn']}; --fail: {p['fail']}; --dim: {p['dim']};
    --accent-default: {p['accent']};
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; }}
  body {{ background: var(--bg); color: var(--ink);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 16px; line-height: 1.55; }}
  .wrap {{ max-width: 1080px; margin: 0 auto; padding: 28px 32px 60px; }}
  section.fullwidth {{ margin-top: 64px; padding: 36px 32px 80px;
    border-top: 1px solid var(--border); background: var(--bg-soft); }}
  section.fullwidth > h2.section {{ max-width: 1280px; margin: 0 auto 4px;
    font-size: 22px; }}
  section.fullwidth > p.hint {{ max-width: 1280px; margin: 0 auto 22px; }}
  section.fullwidth > .graph-embed,
  section.fullwidth > .auto-graph-wrap {{ max-width: 1600px; margin: 0 auto; }}
  .mono, code {{ font-family: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace; }}
  a {{ color: var(--air); text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
  .dim {{ color: var(--dim); }}

  /* ── HERO ───────────────────────────────────────────────── */
  .hero {{ border: 1px solid var(--border); border-left: 6px solid var(--accent);
    padding: 28px 32px; background: var(--bg-soft);
    display: grid; grid-template-columns: 1fr auto; gap: 36px; align-items: start; }}
  .hero-main {{ min-width: 0; }}
  .hero .eyebrow {{ margin: 0 0 8px; font-size: 12px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--muted); }}
  .hero h1 {{ font-size: 38px; font-weight: 700; margin: 0 0 8px;
    letter-spacing: -0.02em; line-height: 1.05; color: var(--ink); }}
  .hero .oneliner {{ font-size: 18px; line-height: 1.45; color: var(--ink);
    margin: 0 0 18px; max-width: 60ch; }}
  .hero .oneliner em {{ color: var(--muted); font-size: 15px; }}
  .hero .status-line {{ margin: 0 0 12px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }}
  .hero .pill {{ display: inline-block; padding: 5px 14px; color: white;
    font-family: "JetBrains Mono", monospace;
    font-size: 13px; font-weight: 700; letter-spacing: 0.14em; border-radius: 2px; }}
  .hero .reason {{ font-size: 14px; color: var(--muted); }}
  .hero .next {{ margin: 0; font-size: 15px; color: var(--ink);
    padding: 10px 14px; background: white;
    border: 1px dashed var(--border-2); border-left: 3px solid var(--accent-default); }}
  .hero .next-tag {{ color: var(--accent-default); font-weight: 700; letter-spacing: 0.08em; margin-right: 8px; }}
  .hero-meta {{ font-size: 12.5px; color: var(--muted); text-align: right;
    line-height: 1.7; white-space: nowrap; }}
  .hero-meta strong {{ color: var(--ink); font-weight: 600; }}
  @media (max-width: 760px) {{
    .hero {{ grid-template-columns: 1fr; padding: 22px 22px; }}
    .hero-meta {{ text-align: left; }}
    .hero h1 {{ font-size: 30px; }}
  }}

  /* ── HEALTH ROW ─────────────────────────────────────────── */
  .health-row {{ display: flex; flex-wrap: wrap; gap: 0;
    margin: 10px 0 0; padding: 10px 14px;
    background: white; border: 1px solid var(--border);
    font-size: 12.5px; }}
  .health-cell {{ padding: 2px 14px; border-right: 1px solid var(--border);
    color: var(--muted); }}
  .health-cell:last-child {{ border-right: 0; }}
  .health-ok {{ color: var(--ok); }}
  .health-ok span, .health-warn {{ color: var(--warn); }}
  .health-fail {{ color: var(--fail); }}
  .health-dim {{ color: var(--dim); }}

  /* ── COMPASS ────────────────────────────────────────────── */
  .compass {{ margin: 16px 0 0; padding: 12px 16px;
    background: var(--bg-soft); border: 1px solid var(--border);
    border-left: 3px solid var(--water);
    font-size: 13.5px; color: var(--ink); line-height: 1.6; }}
  .compass strong {{ color: var(--ink); }}
  .compass em {{ color: var(--muted); font-style: italic; }}
  .compass a {{ color: var(--air); font-family: "JetBrains Mono", monospace;
    font-size: 12.5px; }}

  /* ── NAV STRIP (sticky) ─────────────────────────────────── */
  nav.strip {{ position: sticky; top: 0; z-index: 10;
    display: flex; flex-wrap: wrap; gap: 4px; margin: 28px 0 36px;
    padding: 10px 4px; background: var(--bg);
    border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
    font-size: 13px; align-items: center; }}
  nav.strip a {{ color: var(--muted); padding: 5px 12px; border-radius: 3px; }}
  nav.strip a:hover {{ color: var(--air); background: var(--bg-soft); text-decoration: none; }}
  nav.strip a.cta {{ margin-left: auto; color: var(--air); font-weight: 600; }}

  /* ── SECTIONS ──────────────────────────────────────────── */
  h2.section {{ font-size: 20px; font-weight: 600; color: var(--ink);
    margin: 56px 0 4px; letter-spacing: -0.01em; }}
  p.hint {{ color: var(--muted); font-size: 13.5px; line-height: 1.55;
    margin: 0 0 18px; max-width: 78ch; }}
  p.hint code {{ background: var(--bg-soft); padding: 1px 6px;
    font-size: 12.5px; color: var(--ink); }}
  /* legacy support — old curated sections may still use these */
  h2.section .id {{ color: var(--air); }}
  .section-note {{ color: var(--muted); letter-spacing: 0; text-transform: none;
    font-weight: normal; font-family: Inter, sans-serif; font-size: 13px; }}

  .prose {{ font-size: 15px; line-height: 1.6; }}
  .prose p {{ margin: 0 0 12px; }}
  .prose ul, .prose ol {{ margin: 0 0 14px; padding-left: 22px; }}
  .prose li {{ margin: 4px 0; }}
  .prose h3, .prose h4 {{ font-size: 14px; margin: 18px 0 6px;
    font-family: "JetBrains Mono", monospace; color: var(--ink); }}
  .prose code {{ background: var(--bg-soft); padding: 1px 6px;
    font-size: 13.5px; color: var(--ink); }}
  .prose a {{ color: var(--air); }}

  /* curated markdown tables */
  .md-table-wrap {{ overflow-x: auto; margin: 0 0 14px; }}
  table.md-table {{ width: 100%; border-collapse: collapse;
    font-size: 13.5px; font-family: "JetBrains Mono", monospace; }}
  table.md-table th, table.md-table td {{ padding: 8px 12px;
    border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }}
  table.md-table thead th {{ background: var(--bg-soft); color: var(--ink);
    font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; font-size: 11.5px; }}
  table.md-table tr:hover td {{ background: var(--bg-soft); }}

  /* ── PICKUP ─────────────────────────────────────────────── */
  .pickup-card {{ border: 1px solid var(--border); border-left: 4px solid var(--water);
    background: white; padding: 16px 20px; }}
  .pickup-src {{ font-size: 12px; color: var(--muted); margin-bottom: 8px; }}
  .pickup-text {{ font-size: 15px; line-height: 1.6; margin: 0; color: var(--ink); }}

  /* ── LOOSE ENDS ─────────────────────────────────────────── */
  .loose-grid {{ display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }}
  .loose-panel {{ border: 1px solid var(--border); background: white;
    padding: 14px 16px; }}
  .loose-head {{ font-size: 12px; letter-spacing: 0.10em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 4px;
    display: flex; align-items: baseline; justify-content: space-between; }}
  .loose-count {{ font-size: 17px; font-weight: 700; }}
  .loose-sub {{ font-size: 12px; color: var(--muted); margin: 0 0 10px;
    line-height: 1.45; }}
  .loose-list {{ margin: 0; padding: 0; list-style: none; font-size: 12.5px;
    font-family: "JetBrains Mono", monospace; line-height: 1.7; }}
  .loose-list li {{ padding: 3px 0; border-bottom: 1px dashed var(--border);
    word-break: break-all; }}
  .loose-list li:last-child {{ border-bottom: 0; }}
  .loose-list li.more {{ color: var(--muted); font-style: italic; border: 0; }}
  .loose-status {{ display: inline-block; min-width: 28px; padding: 1px 5px;
    background: var(--bg-soft); color: var(--warn); font-size: 11.5px; margin-right: 4px; }}
  .loose-list .todo-text {{ color: var(--muted); font-family: Inter, sans-serif;
    font-size: 12.5px; }}
  .loose-list code {{ background: transparent; color: var(--ink); padding: 0; }}
  .loose-panel .empty {{ font-size: 13px; }}

  /* ── WAVES + GRAPH ──────────────────────────────────────── */
  .flow-frame {{ border: 1px solid var(--border);
    background: linear-gradient(var(--bg-soft) 1px, transparent 1px) 0 0 / 100% 14px,
                linear-gradient(90deg, var(--bg-soft) 1px, transparent 1px) 0 0 / 14px 100%,
                var(--bg);
    background-blend-mode: multiply; padding: 22px 12px 18px; overflow-x: auto; }}
  .flow-frame svg {{ display: block; width: 100%; min-width: 940px; height: auto; }}
  .waves-table {{ margin-top: 14px; }}
  .graph-embed {{ position: relative; border: 1px solid var(--border);
    background: var(--bg-soft); border-radius: 4px; overflow: hidden; }}
  .graph-embed iframe {{ display: block; width: 100%; height: 78vh; min-height: 600px;
    border: 0; background: white; }}
  .graph-embed .open-full {{ position: absolute; top: 10px; right: 14px;
    font-family: "JetBrains Mono", monospace; font-size: 12px; color: var(--air);
    background: white; padding: 5px 10px; border: 1px solid var(--border);
    border-radius: 3px; z-index: 2; text-decoration: none; }}
  .graph-embed .open-full:hover {{ background: var(--bg); }}

  /* ── DIRECTORY MAP TILES ────────────────────────────────── */
  .dir-grid {{ display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px; }}
  .dir-tile {{ border: 1px solid var(--border);
    border-top: 4px solid var(--tile-accent, var(--muted));
    background: white; padding: 14px 16px;
    display: flex; flex-direction: column; gap: 6px;
    transition: border-color 0.15s, background 0.15s; }}
  .dir-tile:hover {{ background: var(--bg-soft); border-color: var(--tile-accent); }}
  .dir-tile-name {{ font-size: 15px; font-weight: 700; color: var(--ink);
    letter-spacing: -0.01em; word-break: break-all; }}
  .dir-tile-stats {{ display: flex; justify-content: space-between;
    font-size: 12.5px; color: var(--muted); }}
  .dir-tile-kind {{ color: var(--tile-accent); font-weight: 600; letter-spacing: 0.02em; }}
  .dir-tile-count {{ color: var(--muted); }}
  .dir-tile-age {{ font-size: 11.5px; color: var(--muted); }}

  /* ── GRAPH PLACEHOLDER ──────────────────────────────────── */
  .graph-placeholder {{ border: 1px dashed var(--border-2);
    background: var(--bg-soft); padding: 22px 26px; }}
  .graph-placeholder p {{ margin: 0 0 12px; font-size: 14.5px; }}
  .graph-placeholder pre {{ background: white; border: 1px solid var(--border);
    padding: 14px 16px; font-size: 12.5px; line-height: 1.55;
    overflow-x: auto; margin: 12px 0; color: var(--ink); }}

  /* ── CARDS ──────────────────────────────────────────────── */
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 12px; }}
  .card {{ border: 1px solid var(--border); padding: 14px 16px 15px;
    background: white; transition: border-color 0.15s, background 0.15s; }}
  .card:hover {{ border-color: var(--air); background: var(--bg-soft); }}
  .card .id {{ font-family: "JetBrains Mono", monospace; font-size: 13.5px;
    font-weight: 600; color: var(--air); letter-spacing: -0.01em; }}
  .card .id.cn {{ color: var(--water); }}
  .card .id.sc {{ color: var(--thesis); }}
  .card .id.pp {{ color: #5A5A5A; }}
  .card .path {{ font-family: "JetBrains Mono", monospace; font-size: 12.5px;
    color: var(--ink); margin-top: 5px; word-break: break-all; }}
  .card .meta-line {{ font-size: 11.5px; color: var(--muted); margin-top: 3px; }}
  .card .extras {{ font-size: 11.5px; color: var(--muted); margin-top: 2px; }}
  .card .desc {{ font-size: 13.5px; color: var(--ink); margin-top: 8px; line-height: 1.5; }}
  .card .missing {{ color: var(--fail); font-weight: 600; }}
  .card .external {{ color: var(--muted); font-style: italic; }}

  /* ── GUARDRAIL CARDS ────────────────────────────────────── */
  /* Colour-coded left border by kind so the eye can scan categories: */
  /* orange = blocks the action; blue = test catches it; green = rules/runbook; grey = config. */
  .guardrail-legend {{ display: flex; flex-wrap: wrap; gap: 16px;
    margin: 6px 0 18px; font-size: 12.5px; color: var(--muted); }}
  .guardrail-legend .dot {{ display: inline-block; width: 9px; height: 9px;
    border-radius: 2px; margin-right: 5px; vertical-align: middle; }}
  .guardrail-grid {{ display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }}
  .guardrail-card {{ border: 1px solid var(--border); background: white;
    padding: 14px 16px 12px; border-radius: 4px;
    transition: border-color 0.15s, background 0.15s;
    border-left-width: 4px; }}
  .guardrail-card:hover {{ background: var(--bg-soft); }}
  .guardrail-card.k-block   {{ border-left-color: #C25A1D; }}
  .guardrail-card.k-test    {{ border-left-color: var(--air); }}
  .guardrail-card.k-config  {{ border-left-color: var(--dim); }}
  .guardrail-card.k-runbook {{ border-left-color: var(--water); }}
  .guardrail-card.k-rules   {{ border-left-color: var(--water); }}
  .guardrail-card .title {{ font-weight: 600; color: var(--ink);
    font-size: 14.5px; letter-spacing: -0.005em; }}
  .guardrail-card .path {{ font-size: 11.5px; color: var(--air);
    margin-top: 4px; word-break: break-all; }}
  .guardrail-card .path a {{ color: var(--air); }}
  .guardrail-card .protects {{ font-size: 13px; color: var(--ink);
    margin-top: 8px; line-height: 1.5; }}
  .guardrail-card .when {{ font-size: 11.5px; color: var(--muted);
    margin-top: 6px; font-style: italic; }}
  .guardrail-card .when::before {{ content: "When: "; font-style: normal;
    text-transform: uppercase; letter-spacing: 0.04em; font-size: 10.5px;
    color: var(--muted); margin-right: 4px; }}

  /* ── DOC LISTS / TOUCH LISTS ────────────────────────────── */
  .touch-list, .doc-list {{ margin: 8px 0 0; padding: 0; list-style: none; }}
  .touch-list li, .doc-list li {{ padding: 6px 0; font-size: 14.5px;
    border-bottom: 1px dashed var(--border); }}
  .touch-list li:last-child, .doc-list li:last-child {{ border-bottom: 0; }}
  .touch-list code, .doc-list code {{ color: var(--air); background: var(--bg-soft);
    padding: 1px 6px; font-size: 13px; }}
  .doc-list .note {{ color: var(--muted); font-family: Inter, sans-serif; font-size: 13px; }}

  #superseded {{ opacity: 0.65; }}
  #superseded:hover {{ opacity: 1; }}
  .empty {{ color: var(--muted); font-style: italic; }}

  footer {{ max-width: 1080px; margin: 40px auto 0;
    padding: 22px 32px 32px;
    border-top: 1px solid var(--border);
    font-size: 12px; color: var(--muted);
    display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }}
  footer code {{ background: var(--bg-soft); padding: 1px 5px; color: var(--ink); }}
  @media (max-width: 720px) {{
    .wrap {{ padding: 20px 18px 40px; }}
    section.fullwidth {{ padding: 24px 18px 60px; }}
    footer {{ padding: 22px 18px 30px; }}
    .health-row {{ font-size: 11.5px; }}
  }}
</style>
</head>
<body>
<div class="wrap">

  {hero_html}
  {health_html}

  <p class="compass">
    <strong>How to read this page:</strong>
    the card at the top says what this project <em>is</em> and where you left off ·
    the coloured row shows what's healthy and what isn't ·
    <a href="#loose_ends">Loose ends</a> lists what's still open ·
    <a href="#waves">Phases of work</a> is the timeline ·
    <a href="#map">Folder map</a> is the folder layout ·
    <a href="#canonical">Important files</a> are the source-of-truth files ·
    everything below that is reference.
    The interactive <a href="#graph">Code map</a> lives at the very bottom of the page.
  </p>

  <nav class="strip">
    <a href="#status">Status</a>
    <a href="#guardrails">Guardrails</a>
    {'<a href="#pickup">Where we left off</a>' if data["checkpoint"] else ''}
    <a href="#loose_ends">Loose ends</a>
    <a href="#waves">Phases</a>
    <a href="#map">Folder map</a>
    <a href="#canonical">Important files</a>
    <a href="#concepts">Glossary</a>
    <a href="#scripts">Scripts</a>
    <a href="#decisions">Decisions</a>
    <a href="#plans">Plans</a>
    <a href="#collaborators">People</a>
    <a href="#activity">Recent activity</a>
    <a href="#superseded">Archived</a>
    {index_link}
  </nav>

  {status_html}
  {guardrails_html}
  {pickup_html}
  {loose_html}

  <section id="waves">
    {section_heading("waves")}
    <div class="flow-frame">{waves_svg}</div>
    {waves_table}
  </section>

  {map_section}

  <section id="canonical">
    {section_heading("canonical")}
    {cards([canonical_cards])}
  </section>

  <section id="concepts">
    {section_heading("concepts")}
    {cards([concept_cards])}
  </section>

  <section id="scripts">
    {section_heading("scripts")}
    {cards([script_cards])}
  </section>

  <section id="decisions">
    {section_heading("decisions")}
    <ul class="doc-list">{decision_list}</ul>
  </section>

  <section id="plans">
    {section_heading("plans")}
    <ul class="doc-list">{plan_list}</ul>
  </section>

  <section id="collaborators">
    {section_heading("collaborators")}
    {cards([collab_cards])}
  </section>

  <section id="activity">
    {section_heading("activity")}
    <ul class="doc-list">{activity_list}</ul>
  </section>

  <section id="superseded">
    {section_heading("superseded")}
    {superseded_block}
  </section>

</div>

{graph_section}

<footer>
  <span>This page rebuilds itself from the project — don't edit it directly. Curate via <code>HUB.md</code> and <code>docs/hub.yaml</code>.</span>
  <span>Updated {datetime.now().strftime('%Y-%m-%d %H:%M')}</span>
</footer>

</body>
</html>
"""


# --- main -----------------------------------------------------------------

def render_brief(data: dict) -> str:
    """Compact markdown project brief for an agent's session-start memory load.
    Same data as HUB.html, none of the chrome. Designed to be read once at the
    top of a session instead of re-exploring the repo; stays well under ~150
    lines on a big project via per-section caps."""
    L: list[str] = []
    st = data["status"]
    ages = data.get("curated_ages") or {}

    def src_note(info: dict | None) -> str:
        if not info:
            return ""
        note = f" _(from {info['path']}, {info['age']}"
        if info["stale"]:
            why = (f"{info['commits_since']} commits since"
                   if info["commits_since"] >= 2 else "over 30 d old")
            note += f" — ⚠ {why}, check it still holds"
        return note + ")_"

    L.append(f"# {data['project']} — agent brief")
    one = data.get("oneliner", "")
    if one:
        L.append(f"{one}")
    line = f"branch `{data['branch']}` · status **{st['pill']}**"
    if st.get("reason"):
        line += f" ({st['reason']})"
    L.append(line + src_note(ages.get("status")))
    L.append(f"\n**NEXT →** {data['next_action']}" + src_note(ages.get("next")))

    cp = data.get("checkpoint")
    if cp:
        age = f", {cp['age']}" if cp.get("age") else ""
        warn = (f" — ⚠ {cp['commits_since']} commits since, treat as stale"
                if cp.get("stale") else "")
        L.append(f"\n## Where we left off ({cp['path']}{age}{warn})")
        L.append(cp["snippet"])

    auto = data.get("auto_checkpoint")
    if auto and (not cp or not cp.get("mtime") or auto["mtime"] > cp["mtime"]):
        src = ("fresher than the handover above; machine-written, so trust it "
               "for what actually happened last" if cp
               else "no handover file found — this is the only session memory")
        L.append(f"\n## Last session (auto-checkpoint, {auto['age']} — {src})")
        if auto.get("summary"):
            L.append(auto["summary"])
        if auto["completed"]:
            L.append("- worked on: " + " · ".join(auto["completed"]))
        if auto["in_progress"]:
            L.append("- in progress: " + " · ".join(auto["in_progress"]))
        if auto["next_steps"]:
            L.append("- next steps: " + " · ".join(auto["next_steps"]))
        if auto["last_prompt"]:
            L.append(f"- last prompt: “{auto['last_prompt']}”")

    loose = data["loose"]
    L.append("\n## Loose ends")
    if loose["uncommitted"]:
        items = " · ".join(f"{u['status']} {u['path']}" for u in loose["uncommitted"][:10])
        more = len(loose["uncommitted"]) - 10
        L.append(f"- uncommitted ({len(loose['uncommitted'])}): {items}"
                 + (f" · +{more} more" if more > 0 else ""))
    if loose["unpushed"]:
        items = " · ".join(f"{c['hash']} {c['subject']}" for c in loose["unpushed"][:5])
        L.append(f"- unpushed ({len(loose['unpushed'])}): {items}")
    if loose["todos"]:
        items = " · ".join(f"{t['path']}:{t['line']}" for t in loose["todos"][:8])
        L.append(f"- TODOs ({len(loose['todos'])}{'+' if len(loose['todos']) >= 12 else ''}): {items}")
    if loose["drafts"]:
        items = " · ".join(f"{d['path']} ({d['when']})" for d in loose["drafts"][:5])
        L.append(f"- drafts: {items}")
    if not any(loose.values()):
        L.append("- clean: nothing uncommitted, unpushed, or in flight")

    if data["canonical"]:
        L.append("\n## Source-of-truth files (everything else is draft or history)")
        for c in data["canonical"]:
            age = f" ({c['age']})" if c.get("age") else ""
            missing = " — MISSING ON DISK" if c.get("exists") is False else ""
            L.append(f"- `{c.get('path_primary') or c.get('path', '')}` — {c.get('desc', c.get('name', ''))}{age}{missing}")

    if data["concepts"]:
        L.append("\n## Glossary (project vocabulary — use these terms)")
        for c in data["concepts"][:20]:
            L.append(f"- **{c['name']}** — {c['desc']}")

    if data["decisions"]:
        L.append("\n## Decisions (ADRs — read before refactoring; don't undo silently)")
        for d in data["decisions"]:
            L.append(f"- {d['title']} (`{d['path']}`)")

    if data["plans"]:
        L.append("\n## Plans in flight")
        for p in data["plans"]:
            L.append(f"- {p['title']} (`{p['path']}`)")

    if data["guardrails"]:
        L.append("\n## Guardrails (never bypass; fix the cause, not the check)")
        for g in data["guardrails"][:15]:
            L.append(f"- {g['name']} — {g.get('when', '')} (`{g['path']}`)")

    learnings = data.get("learnings") or []
    if learnings:
        L.append("\n## Learnings (recent corrections + gotchas — don't repeat these)")
        for e in learnings:
            L.append(f"- {e}")

    if data["scripts"]:
        L.append("\n## Scripts")
        for s in data["scripts"][:15]:
            L.append(f"- {s['name']} (`{s['path']}`)")
        if len(data["scripts"]) > 15:
            L.append(f"- … +{len(data['scripts']) - 15} more (see HUB.html)")

    if data["recent_activity"]:
        L.append("\n## Recent commits")
        for a in data["recent_activity"]:
            who = f" — {a['who']}" if a.get("who") else ""
            L.append(f"- {a['hash']} {a['subject']} ({a['when']}{who})")

    mem_ages = data.get("memory_ages") or []
    if mem_ages:
        L.append("\n**Memory file ages:** " + " · ".join(mem_ages))

    if data.get("script_update"):
        L.append(f"\n**Script update:** `scripts/build_hub.py` here is version "
                 f"{HUB_VERSION}; the skill master is {data['script_update']}. "
                 f"Diff first and keep any local patch, then re-copy: "
                 f"`diff scripts/build_hub.py {SKILL_MASTER.as_posix().replace(Path.home().as_posix(), '~')}`")

    L.append("\n---")
    L.append("Memory protocol — write at the moment it happens, never wait for session end: "
             "decision → `docs/adr/` · new term/invariant → `CONTEXT.md` · "
             "correction/gotcha → `LEARNINGS.md` · task done, direction changed, or "
             "about to stop → overwrite `HANDOVER.md`. Full dashboard: `docs/HUB.html`.")
    return "\n".join(L) + "\n"


def collect(brief: bool = False) -> dict:
    """brief=True skips the derives whose sections render_brief never prints
    (HTML-only views) — the brief must stay fast enough for a session-start
    hook even on a large repo."""
    o = load_overrides()
    curated = parse_curated(find_curated_hub(o))
    canonical = derive_canonical(o, curated)
    loose = derive_loose_ends()
    status = derive_status(o, curated)
    directory_map = [] if brief else derive_directory_map()
    return {
        "project": derive_project_name(o, curated),
        "oneliner": derive_oneliner(o, curated),
        "branch": git("rev-parse", "--abbrev-ref", "HEAD") or "(detached)",
        "status": status,
        "next_action": derive_next_action(o, curated, status, loose),
        "checkpoint": derive_checkpoint(o),
        "auto_checkpoint": derive_auto_checkpoint() if brief else None,
        "memory_ages": derive_memory_ages() if brief else [],
        "curated_ages": (derive_curated_ages(o, curated, status) if brief
                         else {"next": None, "status": None}),
        "script_update": derive_script_update() if brief else None,
        "loose": loose,
        "health": [] if brief else derive_health(canonical, loose),
        "waves": [] if brief else derive_waves(o, curated),
        "directory_map": directory_map,
        "directory_edges": [] if brief else derive_directory_edges(directory_map, canonical),
        "canonical": canonical,
        "concepts": derive_concepts(o, curated),
        "scripts": derive_scripts(o),
        "guardrails": derive_guardrails(o, curated),
        "collaborators": [] if brief else derive_collaborators(o, curated),
        "superseded": ({"curated_md": "", "items": []} if brief
                       else derive_superseded(curated)),
        "decisions": derive_decisions(),
        "plans": derive_plans(),
        "learnings": derive_learnings(),
        "recent_activity": derive_recent_activity(),
        "curated": curated,
        "_overrides": o,
    }


def main() -> int:
    data = collect(brief="--brief" in sys.argv)

    if "--brief" in sys.argv:
        print(render_brief(data), end="")
        return 0

    out_path = find_output(data["_overrides"])
    html = render(data)

    if "--check" in sys.argv:
        current = out_path.read_text(encoding="utf-8") if out_path.exists() else ""
        if current != html:
            print(f"❌ {out_path.relative_to(ROOT)} is stale.  → run: python3 scripts/build_hub.py")
            return 1
        print(f"✓ {out_path.relative_to(ROOT)} up to date.")
        return 0

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    curated_note = ("HUB.md merged" if data["curated"]
                    else "no curated HUB.md")
    print(f"wrote {out_path.relative_to(ROOT)}  "
          f"(status={data['status']['pill']}, "
          f"{len(data['waves'])} waves, "
          f"{len(data['canonical'])} canonical, "
          f"{len(data['concepts'])} concepts, "
          f"{len(data['scripts'])} scripts, "
          f"{len(data['collaborators'])} contributors, "
          f"loose={len(data['loose']['uncommitted'])}u/"
          f"{len(data['loose']['unpushed'])}p/"
          f"{len(data['loose']['todos'])}t/"
          f"{len(data['loose']['drafts'])}d, "
          f"{curated_note})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
