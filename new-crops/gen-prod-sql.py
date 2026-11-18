#!/usr/bin/env python3
"""Generate the targeted production SQL for Task 3 (31 new crops).

Mirrors lib/catalog/importer.ts semantics exactly:
- series rows from variety.series names, slug <plant>-<slugified series>
- varieties: content_level 'thin' (no description), indexable 1 (active),
  color_family = value or 'unknown', protection 'unknown'
- plants: category flowers; sowing methods in plant_sowing_methods
- media: one hero per plant, licence/credit strings copied from the existing
  crop heroes; created_at supplied explicitly (raw-SQL insert rule)
- updated_seq continues each table's production maximum (plants 1452,
  varieties 2016, series 94 — read live 2026-11-18 before generating)

Usage: gen-prod-sql.py > publish.sql
"""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CATALOG = HERE.parent / "v2" / "seed-data" / "catalog.json"
SRC = "src-new-crops-2026-11-18"
NOW = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
LICENCE = "Own work — original illustration created for Seed Finder"
CREDIT = "Original illustration created for Seed Finder, inspired by reference photography used for colour and form only; the reference photo is not reproduced."

PLANT_SEQ0, VARIETY_SEQ0, SERIES_SEQ0 = 1452, 2016, 94

NEW = [
    "echinacea", "lisianthus", "delphinium", "eryngium", "ageratum", "craspedia",
    "trachelium", "flowering-kale", "safflower", "lavender", "verbena",
    "ranunculus", "columbine", "milkweed", "balloon-flower", "cleome",
    "goldenrod", "honesty", "chinese-lantern", "coleus", "wallflower",
    "false-sunflower", "paper-daisy", "perennial-babys-breath", "anise-hyssop",
    "mullein", "globe-thistle", "false-indigo", "spike-speedwell",
    "masterwort", "hollyhock",
]


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def slugify(name: str) -> str:
    s = name.lower().replace("&", " and ").replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def src_id(slug):
    return f"(SELECT id FROM sources WHERE slug = {q(slug)})"


def plant_id(slug):
    return f"(SELECT id FROM plants WHERE slug = {q(slug)})"


def main():
    catalog = json.loads(CATALOG.read_text())
    plants = {p["slug"]: p for p in catalog["plants"] if p["slug"] in NEW}
    varieties = [v for v in catalog["varieties"] if v["plant"] in NEW]
    assert len(plants) == 31, len(plants)
    out = [f"-- Task 3 publish: 31 new crops, {len(varieties)} varieties. Generated {NOW}."]

    src = next(s for s in catalog["sources"] if s["id"] == SRC)
    out.append(
        "INSERT INTO sources (slug, kind, label, url, checked_date, access) VALUES "
        f"({q(src['id'])}, {q(src['kind'])}, {q(src['label'])}, {q(src['url'])}, {q(src['checkedDate'])}, {q(src['access'])});"
    )

    for i, slug in enumerate(NEW):
        p = plants[slug]
        guide = json.dumps(p["growerGuide"], ensure_ascii=False) if p.get("growerGuide") else None
        out.append(
            "INSERT INTO plants (slug, common_name, latin_name, description, sowing_notes, category_id, updated_seq, "
            "season_class, season_source_id, sowing_method_source_id, life_cycle, hardiness, grower_guide, grower_guide_source_id) VALUES ("
            f"{q(slug)}, {q(p['commonName'])}, {q(p['latinName'])}, {q(p.get('description'))}, {q(p.get('sowingNotes'))}, 1, {PLANT_SEQ0 + i + 1}, "
            f"{q(p.get('seasonClass'))}, {src_id(p['seasonSource']) if p.get('seasonSource') else 'NULL'}, "
            f"{src_id(p['sowingMethodSource']) if p.get('sowingMethodSource') else 'NULL'}, "
            f"{q(p.get('lifeCycle'))}, {q(p.get('hardiness'))}, {q(guide)}, "
            f"{src_id(p['growerGuideSource']) if p.get('growerGuideSource') else 'NULL'});"
        )
        for m in p.get("sowingMethods") or []:
            out.append(f"INSERT INTO plant_sowing_methods (plant_id, method) VALUES ({plant_id(slug)}, {q(m)});")

    series_keys = []
    for v in varieties:
        if v.get("series") and (v["plant"], v["series"]) not in series_keys:
            series_keys.append((v["plant"], v["series"]))
    for i, (plant, name) in enumerate(series_keys):
        out.append(
            "INSERT INTO series (slug, name, plant_id, created_at, updated_at, updated_seq) VALUES ("
            f"{q(plant + '-' + slugify(name))}, {q(name)}, {plant_id(plant)}, {q(NOW)}, {q(NOW)}, {SERIES_SEQ0 + i + 1});"
        )

    for i, v in enumerate(varieties):
        series_sql = (
            f"(SELECT id FROM series WHERE slug = {q(v['plant'] + '-' + slugify(v['series']))})"
            if v.get("series") else "NULL"
        )
        out.append(
            "INSERT INTO varieties (plant_id, slug, variety_name, category_id, subcategory_id, description, sowing_notes, "
            "height_cm, color_swatch, status, content_level, indexable, protection, protection_note, source_id, series_id, "
            "color_family, created_at, updated_at, updated_seq) VALUES ("
            f"{plant_id(v['plant'])}, {q(v['slug'])}, {q(v['varietyName'])}, 1, NULL, NULL, NULL, NULL, NULL, 'active', 'thin', 1, "
            f"'unknown', NULL, {src_id(SRC)}, {series_sql}, {q(v.get('colorFamily') or 'unknown')}, {q(NOW)}, {q(NOW)}, {VARIETY_SEQ0 + i + 1});"
        )

    for slug in NEW:
        out.append(
            "INSERT INTO media (variety_id, seller_id, plant_id, r2_key, licence, credit, created_at) VALUES ("
            f"NULL, NULL, {plant_id(slug)}, {q('/artwork/crops/' + slug + '.webp')}, {q(LICENCE)}, {q(CREDIT)}, {q(NOW)});"
        )

    print("\n".join(out))


if __name__ == "__main__":
    main()
