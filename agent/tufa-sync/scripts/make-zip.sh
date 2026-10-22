#!/bin/sh
# Builds a clean, shareable zip of the committed project, git history included.
#
#   scripts/make-zip.sh                  writes dist/cis-client.zip
#   scripts/make-zip.sh ~/Desktop/x.zip  writes that file
#
# The zip is made from a fresh clone, so it holds only committed files: no
# .venv, node_modules, caches, exports or certificates lying around in the folder. The copied
# repository has no remote, hooks, reflog or user identity, and zip stores no
# owner or macOS metadata. Before packing, the script refuses to continue if
# the files or the commit authors point at this computer or your git identity.
set -eu

name=cis-client
root=$(cd "$(dirname "$0")/.." && pwd)
output=${1:-"$root/dist/$name.zip"}
case "$output" in
	/*) ;;
	*) output="$PWD/$output" ;;
esac

cd "$root"
git rev-parse --verify --quiet HEAD >/dev/null || { echo "Nothing committed yet." >&2; exit 1; }
if [ -n "$(git status --porcelain)" ]; then
	echo "Note: uncommitted changes are not included. Commit them first to ship them." >&2
fi

# Committed files must not mention this computer.
problems=0
for needle in "$HOME" "$(id -un)" "$(hostname -s)"; do
	[ ${#needle} -ge 4 ] || continue  # very short names would match ordinary text
	if git grep -I -q -i -F -e "$needle" HEAD -- .; then
		echo "Committed files mention \"$needle\":" >&2
		git grep -I -n -i -F -e "$needle" HEAD -- . | head -n 5 >&2
		problems=1
	fi
done

# Commits must not carry your personal git identity.
personal_name=$(git config --global user.name || true)
personal_email=$(git config --global user.email || true)
identities=$(git log --format='%an <%ae>%n%cn <%ce>' | sort -u)
for value in "$personal_name" "$personal_email" "$(id -un)"; do
	[ ${#value} -ge 4 ] || continue
	if printf '%s\n' "$identities" | grep -q -i -F -e "$value"; then
		echo "Commits are signed with your own identity ($value). Rewrite them with the repository identity:" >&2
		echo "  git rebase -r --root --exec 'git commit --amend --no-edit --reset-author'" >&2
		problems=1
		break
	fi
done
# The web interface must be built and committed, or the zip would not run without Node.
if ! git cat-file -e HEAD:cis_client/web/index.html 2>/dev/null; then
	echo "cis_client/web is not committed: run 'npm run build' in frontend/ and commit the result." >&2
	problems=1
fi
[ "$problems" -eq 0 ] || { echo "Zip not created." >&2; exit 1; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT INT TERM

git clone --quiet --no-local "$root" "$work/$name"
cd "$work/$name"
git remote remove origin
for key in core.ignorecase core.precomposeunicode; do
	git config --unset "$key" || true
done
rm -rf .git/hooks/* .git/logs .git/FETCH_HEAD .git/ORIG_HEAD
git gc --quiet --prune=now

mkdir -p "$(dirname "$output")"
rm -f "$output"
cd "$work"
zip -r -X -q "$output" "$name" -x '*.DS_Store' '*/__pycache__/*' '*.pyc' '*/node_modules/*'

commit=$(git -C "$work/$name" log -1 --format='%h %s')
size=$(du -h "$output" | cut -f1 | tr -d ' ')
echo "Created $output ($size) at $commit"
