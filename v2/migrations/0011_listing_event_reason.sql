-- Listing events: optional reason (admin listing removal records why a listing went 'gone').
-- Additive only: existing rows keep NULL (= no reason recorded).
ALTER TABLE listing_events ADD COLUMN reason TEXT;
