-- SQL Schema for activity_log table in Supabase
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- Create an index on type for filtering
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(type);

-- Add RLS (Row Level Security) policies
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Allow public insert access (for booking form)
CREATE POLICY "Allow public insert access to activity_log"
  ON activity_log FOR INSERT
  USING (true);

-- Allow authenticated users (admin) to read all
CREATE POLICY "Allow authenticated users to read activity_log"
  ON activity_log FOR SELECT
  USING (auth.role() = 'authenticated');
