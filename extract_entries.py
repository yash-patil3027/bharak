"""
One-off helper: reads every element with class="searchable" in public/index.html
and writes db/entries.seed.json (slug, title, category, subcategory, summary, keywords, anchor).
Re-run it whenever you add cards to index.html.
"""
import json, re
from bs4 import BeautifulSoup

html = open("public/index.html", encoding="utf-8").read()
soup = BeautifulSoup(html, "html.parser")

CATEGORY_BY_SECTION = {
    "specialforces": "Special Forces",
    "modernization": "Modernization",
    "recruitment":   "Recruitment",
    "awards":        "Gallantry Awards",
}
CATEGORY_BY_PANEL = {"panel-army": "Army", "panel-navy": "Navy", "panel-airforce": "Air Force"}

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

entries, seen = [], set()
for el in soup.select(".searchable"):
    h = el.find(["h3", "h4"])
    if not h:
        continue
    title = h.get_text(" ", strip=True)

    panel = el.find_parent(class_="branchpanel")
    section = el.find_parent("section")
    if panel:
        category = CATEGORY_BY_PANEL[panel["id"]]
    else:
        category = CATEGORY_BY_SECTION.get(section["id"] if section else "", "General")

    # sub-category = the closest preceding ".subhead" inside the same panel ("Army Commands", ...)
    sub = ""
    if panel:
        prev = el.find_previous(class_="subhead")
        if prev:
            sub = re.sub(r"^\d+\s*", "", prev.get_text(" ", strip=True)).strip()

    p = el.find("p")
    if p:
        summary = p.get_text(" ", strip=True)
    else:  # equipment cards / SF cards
        spec = [s.get_text(strip=True) for s in el.select(".spec span")]
        lis = [l.get_text(" ", strip=True) for l in el.select("li")]
        summary = " · ".join(spec) if spec else " ".join(lis[:1])

    slug = slugify(title)
    if slug in seen:
        slug = f"{slug}-{slugify(category)}"
    seen.add(slug)

    entries.append({
        "slug": slug,
        "title": title,
        "category": category,
        "subcategory": sub,
        "summary": summary,
        "keywords": el.get("data-keywords", ""),
        "anchor": section["id"] if section else "",
        "panel": panel["id"].replace("panel-", "") if panel else "",
    })

json.dump(entries, open("db/entries.seed.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(len(entries), "entries written")
from collections import Counter
print(Counter(e["category"] for e in entries))
