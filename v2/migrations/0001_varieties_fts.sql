-- Custom migration (not drizzle-kit generated): FTS5 trigram index for searchVarieties().
-- Spec FINAL §2 "FTS" + X3. The FTS rowid IS the variety id. All reads of this table live in
-- lib/repositories/fts.ts. D1 export cannot include virtual tables: drop + rebuild around
-- exports (README "Backups / export").
CREATE VIRTUAL TABLE `varieties_fts` USING fts5(
  variety_name,
  common_name,
  latin_name,
  description,
  tags,
  aliases,
  tokenize = 'trigram'
);
--> statement-breakpoint
CREATE TRIGGER `varieties_fts_ai` AFTER INSERT ON `varieties` BEGIN
  INSERT INTO varieties_fts (rowid, variety_name, common_name, latin_name, description, tags, aliases)
  SELECT v.id, v.variety_name, p.common_name, p.latin_name, coalesce(v.description, ''),
    coalesce((SELECT group_concat(t.tag, ' ') FROM variety_tags t WHERE t.variety_id = v.id), ''),
    coalesce((SELECT group_concat(a.alias, ' ') FROM variety_aliases a WHERE a.variety_id = v.id), '')
  FROM varieties v JOIN plants p ON p.id = v.plant_id WHERE v.id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER `varieties_fts_au` AFTER UPDATE ON `varieties` BEGIN
  DELETE FROM varieties_fts WHERE rowid = OLD.id;
  INSERT INTO varieties_fts (rowid, variety_name, common_name, latin_name, description, tags, aliases)
  SELECT v.id, v.variety_name, p.common_name, p.latin_name, coalesce(v.description, ''),
    coalesce((SELECT group_concat(t.tag, ' ') FROM variety_tags t WHERE t.variety_id = v.id), ''),
    coalesce((SELECT group_concat(a.alias, ' ') FROM variety_aliases a WHERE a.variety_id = v.id), '')
  FROM varieties v JOIN plants p ON p.id = v.plant_id WHERE v.id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER `varieties_fts_ad` AFTER DELETE ON `varieties` BEGIN
  DELETE FROM varieties_fts WHERE rowid = OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER `variety_tags_fts_ai` AFTER INSERT ON `variety_tags` BEGIN
  UPDATE varieties_fts
  SET tags = coalesce((SELECT group_concat(t.tag, ' ') FROM variety_tags t WHERE t.variety_id = NEW.variety_id), '')
  WHERE rowid = NEW.variety_id;
END;
--> statement-breakpoint
CREATE TRIGGER `variety_tags_fts_ad` AFTER DELETE ON `variety_tags` BEGIN
  UPDATE varieties_fts
  SET tags = coalesce((SELECT group_concat(t.tag, ' ') FROM variety_tags t WHERE t.variety_id = OLD.variety_id), '')
  WHERE rowid = OLD.variety_id;
END;
--> statement-breakpoint
CREATE TRIGGER `variety_aliases_fts_ai` AFTER INSERT ON `variety_aliases` BEGIN
  UPDATE varieties_fts
  SET aliases = coalesce((SELECT group_concat(a.alias, ' ') FROM variety_aliases a WHERE a.variety_id = NEW.variety_id), '')
  WHERE rowid = NEW.variety_id;
END;
--> statement-breakpoint
CREATE TRIGGER `variety_aliases_fts_ad` AFTER DELETE ON `variety_aliases` BEGIN
  UPDATE varieties_fts
  SET aliases = coalesce((SELECT group_concat(a.alias, ' ') FROM variety_aliases a WHERE a.variety_id = OLD.variety_id), '')
  WHERE rowid = OLD.variety_id;
END;
--> statement-breakpoint
CREATE TRIGGER `plants_fts_au` AFTER UPDATE OF common_name, latin_name ON `plants` BEGIN
  UPDATE varieties_fts
  SET common_name = NEW.common_name, latin_name = NEW.latin_name
  WHERE rowid IN (SELECT id FROM varieties WHERE plant_id = NEW.id);
END;
