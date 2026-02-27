-- Phase 3a: Google Auth + Identity Migration

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  email TEXT,
  tier TEXT CHECK (tier IN ('wonderkid', 'rising_prospect', 'certified', 'seasoned_veteran')),
  survey_responses JSONB,
  survey_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Open RLS (matching existing pattern)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_open' AND tablename = 'profiles') THEN
    CREATE POLICY "profiles_open" ON profiles FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Add user_id to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
