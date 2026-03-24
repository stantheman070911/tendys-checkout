ALTER TABLE public.rounds
ADD COLUMN IF NOT EXISTS pickup_option_a text DEFAULT '面交點 A',
ADD COLUMN IF NOT EXISTS pickup_option_b text DEFAULT '面交點 B';

UPDATE public.rounds
SET
  pickup_option_a = COALESCE(NULLIF(btrim(pickup_option_a), ''), '面交點 A'),
  pickup_option_b = COALESCE(NULLIF(btrim(pickup_option_b), ''), '面交點 B');

ALTER TABLE public.rounds
ALTER COLUMN pickup_option_a SET DEFAULT '面交點 A',
ALTER COLUMN pickup_option_a SET NOT NULL,
ALTER COLUMN pickup_option_b SET DEFAULT '面交點 B',
ALTER COLUMN pickup_option_b SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rounds_pickup_option_a_nonempty'
  ) THEN
    ALTER TABLE public.rounds
    ADD CONSTRAINT rounds_pickup_option_a_nonempty
    CHECK (char_length(btrim(pickup_option_a)) > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rounds_pickup_option_b_nonempty'
  ) THEN
    ALTER TABLE public.rounds
    ADD CONSTRAINT rounds_pickup_option_b_nonempty
    CHECK (char_length(btrim(pickup_option_b)) > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rounds_pickup_options_distinct'
  ) THEN
    ALTER TABLE public.rounds
    ADD CONSTRAINT rounds_pickup_options_distinct
    CHECK (btrim(pickup_option_a) <> btrim(pickup_option_b));
  END IF;
END $$;
