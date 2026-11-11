#!/usr/bin/env python3
"""Print the agent brief: auto-derived + curated project state for a new session.

A *narrative* layer for the repo: project status, where current truth lives,
the named concepts, the runnable scripts, what's loose right now (uncommitted /
unpushed / TODOs / drafts), decisions, guardrails and recent learnings.

The brief pulls from FOUR sources, in increasing curation:

1.  git state                         — status, loose ends, recent commits
2.  filesystem + README/CONTEXT/CLAUDE.md — auto-derived canonical, concepts, scripts
3.  docs/hub.yaml (optional)           — surgical overrides (`oneliner:`, `next_action:`, ...)
4.  HUB.md / docs/HUB.md (optional)    — curated `## :section` bodies, win over auto-derive

Designed to be **project-agnostic** so it runs unchanged in any repo. Heuristics
fill in for everything; overrides are only needed when auto-derive gets it wrong.
The HTML dashboard (HUB.html) was removed on 2026-10-25; the brief is the only
output. The session handover lives in `handover.py` in the skill.

Usage:
    python3 scripts/build_hub.py              # print the agent brief to stdout
    python3 scripts/build_hub.py --brief      # same (the SessionStart hook uses it)
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
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
ADR_DIR = ROOT / "docs" / "adr"
PLANS_DIR = ROOT / "docs" / "plans"
SCRIPTS_DIR = ROOT / "scripts"
LEARNINGS = ROOT / "LEARNINGS.md"

# Bump on every change to the skill master. Installed copies compare their own
# value against the master's so --brief can say "your copy is out of date"; a
# local patch in a repo copy leaves this line alone, so it does not trigger.
HUB_VERSION = "2026-10-25"
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
TODO_SKIP_EXTS = ("csv", "tsv", "json", "jsonl", "ipynb", "html", "svg",
                  "lock", "map", "min.js")


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


def _parse_row(line: str) -> list[str]:
    # strip leading/trailing pipes then split
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


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
    the brief."""
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


# --- rendering ------------------------------------------------------------


# --- main -----------------------------------------------------------------

def render_brief(data: dict) -> str:
    """Compact markdown project brief for an agent's session-start memory load.
    Designed to be read once at the top of a session instead of re-exploring
    the repo; stays well under ~150 lines on a big project via per-section
    caps. handover.py cuts it further to fit the SessionStart hook limit."""
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
            L.append(f"- … +{len(data['scripts']) - 15} more in `scripts/`")

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
             "about to stop → overwrite `HANDOVER.md`.")
    return "\n".join(L) + "\n"


def collect() -> dict:
    """Everything render_brief prints; stays fast enough for a session-start hook."""
    o = load_overrides()
    curated = parse_curated(find_curated_hub(o))
    canonical = derive_canonical(o, curated)
    loose = derive_loose_ends()
    status = derive_status(o, curated)
    return {
        "project": derive_project_name(o, curated),
        "oneliner": derive_oneliner(o, curated),
        "branch": git("rev-parse", "--abbrev-ref", "HEAD") or "(detached)",
        "status": status,
        "next_action": derive_next_action(o, curated, status, loose),
        "checkpoint": derive_checkpoint(o),
        "auto_checkpoint": derive_auto_checkpoint(),
        "memory_ages": derive_memory_ages(),
        "curated_ages": derive_curated_ages(o, curated, status),
        "script_update": derive_script_update(),
        "loose": loose,
        "canonical": canonical,
        "concepts": derive_concepts(o, curated),
        "scripts": derive_scripts(o),
        "guardrails": derive_guardrails(o, curated),
        "decisions": derive_decisions(),
        "plans": derive_plans(),
        "learnings": derive_learnings(),
        "recent_activity": derive_recent_activity(),
    }


def main() -> int:
    if "--check" in sys.argv:  # old pre-commit hooks and CI steps still call it
        print("HUB.html is no longer generated (project-hub 2026-10-25); nothing to check.")
        return 0
    print(render_brief(collect()), end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
