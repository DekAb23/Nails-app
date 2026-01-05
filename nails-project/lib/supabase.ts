import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Debug logging (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('Supabase Config Check:');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Missing');
}

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  const errorMessage = `Missing Supabase environment variables: ${missingVars.join(', ')}. ` +
    `Please check your .env.local file in the project root (${process.cwd()}) and ensure it contains: ` +
    `NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ` +
    `Also make sure to restart your Next.js dev server after adding environment variables.`;
  
  console.error(errorMessage);
  console.error('Current working directory:', process.cwd());
  console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')).join(', ') || 'None found');
  throw new Error(errorMessage);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Booking {
  id?: string;
  service_id: string;
  service_title: string;
  service_duration: number;
  date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  customer_phone: string;
  cancellation_token?: string;
  status?: string;
  created_at?: string;
}

export interface BlockedDate {
  id?: string;
  date: string;
  created_at?: string;
}

