-- SQL Schema for daily_schedules table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS daily_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_schedules_date ON daily_schedules(date);

-- Add RLS (Row Level Security) policies
ALTER TABLE daily_schedules ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the booking page)
CREATE POLICY "Allow public read access to daily_schedules"
  ON daily_schedules FOR SELECT
  USING (true);

-- Allow authenticated users (admin) to insert/update/delete
CREATE POLICY "Allow authenticated users to manage daily_schedules"
  ON daily_schedules FOR ALL
  USING (auth.role() = 'authenticated');

