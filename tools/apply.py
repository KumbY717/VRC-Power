#!/usr/bin/env python3
"""
Write files from a pasted "bundle". Bundle format:

=== FILE: web/app/page.tsx ===
...file contents...
=== END ===
=== DELETE: web/old/file.ts ===

Input: a file path argument, piped stdin, or (default) your clipboard.
Safe by design: stays inside the project, backs up everything it overwrites,
and can be undone with --undo.
"""
import argparse, json, os, re, shutil, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKUPS = ROOT / ".vrc-backup"
MARK = re.compile(r"^\s*={3,}\s*(FILE|DELETE)\s*:\s*(.+?)\s*={3,}\s*$")
END = re.compile(r"^\s*={3,}\s*END\s*={3,}\s*$")
FENCE = re.compile(r"^\s*```[\w+-]*\s*$")
G, Y, R, D, X = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"


def read_clipboard():
    cmds = [["pbpaste"], ["wl-paste"], ["xclip", "-o", "-selection", "clipboard"],
            ["xsel", "-b", "-o"], ["powershell.exe", "-NoProfile", "-Command", "Get-Clipboard -Raw"]]
    for c in cmds:
        try:
            return subprocess.run(c, capture_output=True, text=True, check=True).stdout
        except (OSError, subprocess.CalledProcessError):
            continue
    sys.exit(f"{R}Could not read the clipboard. Save the bundle to a file and run: ./vrc apply bundle.txt{X}")


def parse(text):
    ops, cur = [], None
    for line in text.replace("\r\n", "\n").split("\n"):
        m = MARK.match(line)
        if m:
            if cur:  # new marker without END: close previous block
                ops.append(cur)
            kind, path = m.group(1), m.group(2).strip().strip("`'\"")
            cur = {"kind": kind, "path": path, "lines": []}
            if kind == "DELETE":
                ops.append(cur)
                cur = None
            continue
        if END.match(line):
            if cur:
                ops.append(cur)
            cur = None
            continue
        if cur is not None:
            cur["lines"].append(line)
    if cur:
        ops.append(cur)
    for op in ops:
        if op["kind"] == "FILE":
            ls = op["lines"]
            # tolerate a stray markdown fence copied along with the code
            if ls and FENCE.match(ls[0]):
                ls = ls[1:]
            while ls and not ls[-1].strip():
                ls = ls[:-1]
            if ls and FENCE.match(ls[-1]):
                ls = ls[:-1]
            while ls and not ls[-1].strip():
                ls = ls[:-1]
            op["content"] = "\n".join(ls) + "\n"
    return ops


def safe_path(p):
    p = p.replace("\\", "/")
    while p.startswith("./"):
        p = p[2:]
    if not p or p.startswith("/") or re.match(r"^[A-Za-z]:", p):
        raise ValueError("absolute paths are not allowed")
    full = (ROOT / p).resolve()
    if ROOT not in full.parents:
        raise ValueError("path escapes the project folder")
    parts = set(full.relative_to(ROOT).parts)
    if parts & {".git", "node_modules", ".vrc-backup", ".next"}:
        raise ValueError("protected folder")
    return full


def undo():
    if not BACKUPS.exists():
        sys.exit("Nothing to undo.")
    runs = sorted(d for d in BACKUPS.iterdir() if d.is_dir() and (d / "manifest.json").exists())
    if not runs:
        sys.exit("Nothing to undo.")
    run = runs[-1]
    man = json.loads((run / "manifest.json").read_text())
    for rel in man["created"]:
        f = ROOT / rel
        if f.exists():
            f.unlink()
            print(f"{Y}removed {X}{rel}")
    for rel in man["modified"] + man["deleted"]:
        src = run / "files" / rel
        if src.exists():
            dst = ROOT / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            print(f"{G}restored{X} {rel}")
    (run / "manifest.json").rename(run / "manifest.undone.json")
    print(f"\nUndid run {run.name}.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bundle", nargs="?", help="bundle file (default: stdin or clipboard)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--undo", action="store_true")
    a = ap.parse_args()
    if a.undo:
        return undo()

    if a.bundle:
        text = Path(a.bundle).read_text()
    elif not sys.stdin.isatty():
        text = sys.stdin.read()
    else:
        text = read_clipboard()

    ops = parse(text)
    if not ops:
        sys.exit(f"{R}No '=== FILE: path ===' blocks found. Did you copy the whole code block?{X}")

    stamp = time.strftime("%Y%m%d-%H%M%S")
    run = BACKUPS / stamp
    man = {"created": [], "modified": [], "deleted": []}
    errors = 0
    for op in ops:
        try:
            full = safe_path(op["path"])
        except ValueError as e:
            print(f"{R}skip   {X}{op['path']}  ({e})")
            errors += 1
            continue
        rel = str(full.relative_to(ROOT))
        exists = full.exists()
        if op["kind"] == "DELETE":
            if not exists:
                print(f"{D}absent {X}{rel}")
                continue
            print(f"{Y}delete {X}{rel}")
            if not a.dry_run:
                (run / "files" / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(full, run / "files" / rel)
                full.unlink()
                man["deleted"].append(rel)
            continue
        if exists and full.read_text(errors="replace") == op["content"]:
            print(f"{D}same   {X}{rel}")
            continue
        print(f"{G}{'update' if exists else 'create'} {X}{rel}")
        if a.dry_run:
            continue
        if exists:
            (run / "files" / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(full, run / "files" / rel)
            man["modified"].append(rel)
        else:
            man["created"].append(rel)
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(op["content"])

    if not a.dry_run and any(man.values()):
        run.mkdir(parents=True, exist_ok=True)
        (run / "manifest.json").write_text(json.dumps(man, indent=2))
    print(f"\n{len(ops)} block(s) read" + (f", {errors} skipped" if errors else "") +
          (" (dry run, nothing written)" if a.dry_run else ". Undo with: ./vrc undo"))


if __name__ == "__main__":
    main()
