-- SQL Schema for business_hours table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS business_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER NOT NULL UNIQUE CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL DEFAULT '09:00:00',
  end_time TIME NOT NULL DEFAULT '18:00:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on day_of_week for faster queries
CREATE INDEX IF NOT EXISTS idx_business_hours_day ON business_hours(day_of_week);

-- Insert default business hours (Sunday-Thursday active, Friday-Saturday inactive)
INSERT INTO business_hours (day_of_week, is_active, start_time, end_time)
VALUES
  (0, true, '09:00:00', '18:00:00'),  -- Sunday
  (1, true, '09:00:00', '18:00:00'),  -- Monday
  (2, true, '09:00:00', '18:00:00'),  -- Tuesday
  (3, true, '09:00:00', '18:00:00'),  -- Wednesday
  (4, true, '09:00:00', '18:00:00'),  -- Thursday
  (5, false, '09:00:00', '18:00:00'), -- Friday (inactive)
  (6, false, '09:00:00', '18:00:00')  -- Saturday (inactive)
ON CONFLICT (day_of_week) DO NOTHING;

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_hours_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_business_hours_updated_at_trigger
  BEFORE UPDATE ON business_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_business_hours_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the booking page)
CREATE POLICY "Allow public read access to business_hours"
  ON business_hours FOR SELECT
  USING (true);

-- Allow authenticated users (admin) to insert/update/delete
CREATE POLICY "Allow authenticated users to manage business_hours"
  ON business_hours FOR ALL
  USING (auth.role() = 'authenticated');

