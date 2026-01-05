-- SQL Schema for blocked_time_slots table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS blocked_time_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on the date column for faster queries
CREATE INDEX IF NOT EXISTS idx_blocked_time_slots_date ON blocked_time_slots(date);

-- Add RLS (Row Level Security) policies
ALTER TABLE blocked_time_slots ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the booking page)
CREATE POLICY "Allow public read access to blocked_time_slots"
  ON blocked_time_slots FOR SELECT
  USING (true);

-- Allow authenticated users (admin) to insert/update/delete
CREATE POLICY "Allow authenticated users to manage blocked_time_slots"
  ON blocked_time_slots FOR ALL
  USING (auth.role() = 'authenticated');

