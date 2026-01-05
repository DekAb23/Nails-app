-- SQL Schema for blocked_dates table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on the date column for faster queries
CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON blocked_dates(date);

-- Add RLS (Row Level Security) policies if needed
-- Allow public read access (for the booking page)
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to blocked_dates"
  ON blocked_dates FOR SELECT
  USING (true);

-- Allow authenticated users (admin) to insert/update/delete
-- Note: You may need to adjust this based on your authentication setup
CREATE POLICY "Allow authenticated users to manage blocked_dates"
  ON blocked_dates FOR ALL
  USING (auth.role() = 'authenticated');


