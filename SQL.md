
# Database Setup & Migration Script (Supabase)

This SQL script sets up the complete backend infrastructure for **Fasal Rakshak**.

### 🚨 CRITICAL FIXES INCLUDED
1. **Role Constraint**: Updated to allow `agent` and `driver` roles.
2. **Phone Column**: Renamed `phone` to `phone_number` to match your existing schema.
3. **Location Fix**: added missing PostGIS column.

### How to use
1.  Go to your **Supabase Dashboard**.
2.  Navigate to the **SQL Editor**.
3.  Paste the code below into a new query window.
4.  Click **Run**.

---

```sql
-- 1. Enable Extensions & Base Configuration
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Profiles (Users) Table & Updates
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE,
  full_name TEXT,
  email TEXT UNIQUE,
  phone_number TEXT UNIQUE, -- MATCHES YOUR SCHEMA
  avatar_url TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FIX: Update Role Constraint to allow Agent and Driver
DO $$
BEGIN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('farmer', 'admin', 'agent', 'driver'));
EXCEPTION
    WHEN undefined_object THEN
        -- Handle case where table/constraint doesn't exist yet
        NULL;
END $$;

-- Add missing columns to 'profiles' safely
DO $$
BEGIN
    -- Core Identity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'farmer_id') THEN
        ALTER TABLE profiles ADD COLUMN farmer_id TEXT;
    END IF;
    
    -- Role Management
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'farmer';
    END IF;

    -- Farming Details
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'crops_grown') THEN
        ALTER TABLE profiles ADD COLUMN crops_grown TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'land_size') THEN
        ALTER TABLE profiles ADD COLUMN land_size NUMERIC DEFAULT 1.0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'water_source') THEN
        ALTER TABLE profiles ADD COLUMN water_source TEXT DEFAULT 'Rainfed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'location') THEN
        ALTER TABLE profiles ADD COLUMN location JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone_number') THEN
        ALTER TABLE profiles ADD COLUMN phone_number TEXT;
    END IF;

    -- App Settings & Usage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'preferred_languages') THEN
        ALTER TABLE profiles ADD COLUMN preferred_languages TEXT[] DEFAULT '{en}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'usage') THEN
        ALTER TABLE profiles ADD COLUMN usage JSONB DEFAULT '{"scans_this_month": 0, "last_reset_date": 0}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'plan_id') THEN
        ALTER TABLE profiles ADD COLUMN plan_id TEXT DEFAULT 'basic';
    END IF;

    -- IoT & Advanced Features
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'weather_mode') THEN
        ALTER TABLE profiles ADD COLUMN weather_mode TEXT DEFAULT 'online';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'iot_config') THEN
        ALTER TABLE profiles ADD COLUMN iot_config JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'crop_portfolio') THEN
        ALTER TABLE profiles ADD COLUMN crop_portfolio JSONB;
    END IF;
    
    -- Agent Specific Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'assigned_mandi') THEN
        ALTER TABLE profiles ADD COLUMN assigned_mandi JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'agent_accuracy_score') THEN
        ALTER TABLE profiles ADD COLUMN agent_accuracy_score NUMERIC DEFAULT 0;
    END IF;
    
    -- Driver Specific Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'driver_details') THEN
        ALTER TABLE profiles ADD COLUMN driver_details JSONB;
    END IF;
END $$;

-- 3. Diagnosis & Reports
CREATE TABLE IF NOT EXISTS diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  crop TEXT, 
  disease TEXT, 
  severity TEXT,
  health_score NUMERIC,
  image_url TEXT,
  location JSONB, 
  full_data JSONB, 
  feedback_rating NUMERIC,
  feedback_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fix location_point missing error
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diagnoses' AND column_name = 'location_point') THEN
        ALTER TABLE diagnoses ADD COLUMN location_point GEOMETRY(POINT, 4326);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS diagnoses_location_idx ON diagnoses USING GIST (location_point);

-- 4. Other Tables (Standard)
CREATE TABLE IF NOT EXISTS crop_plans (
  id TEXT PRIMARY KEY, 
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  crop_name TEXT,
  status TEXT, 
  plan_data JSONB, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT,
  district TEXT,
  mandi TEXT,
  crop TEXT,
  price TEXT,
  trend TEXT,
  date TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mandi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  mandi_name TEXT,
  crop TEXT,
  variety TEXT,
  price_min TEXT,
  price_max TEXT,
  price_modal TEXT,
  quantity TEXT,
  status TEXT DEFAULT 'Pending', 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  tags TEXT[],
  location JSONB,
  likes_count NUMERIC DEFAULT 0,
  comments_count NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, 
  is_group BOOLEAN DEFAULT FALSE,
  group_avatar TEXT,
  description TEXT,
  last_message TEXT,
  last_message_type TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_participants (
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  type TEXT DEFAULT 'text', 
  media_url TEXT,
  media_duration NUMERIC,
  report_data JSONB, 
  read_by UUID[], 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_config (
  id TEXT PRIMARY KEY, 
  config JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_content (
  id TEXT PRIMARY KEY, 
  content JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY, 
  name TEXT,
  price NUMERIC,
  interval TEXT,
  features JSONB, 
  limits JSONB, 
  recommended BOOLEAN
);

CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  service TEXT,
  status TEXT,
  latency_ms NUMERIC,
  error_message TEXT,
  endpoint TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  summary TEXT,
  full_content TEXT,
  source TEXT,
  url TEXT,
  image_url TEXT,
  state TEXT,
  related_crops TEXT[],
  published_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  provider TEXT,
  state TEXT,
  benefit TEXT,
  details TEXT,
  link TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  crop TEXT,
  category TEXT,
  content TEXT,
  read_time TEXT,
  video_links JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crops (
  id TEXT PRIMARY KEY,
  name_en TEXT,
  category TEXT,
  image TEXT
);

-- 9. Storage Setup
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'uploads' );
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'uploads' AND auth.role() = 'authenticated' );

-- 10. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mandi_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
```
