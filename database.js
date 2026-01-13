import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// SAFE access with optional chaining
const extra = Constants.expoConfig?.extra;

// Use the SAME keys you defined in app.config.js
const supabaseUrl = extra?.supabaseUrl;
const supabaseAnonKey = extra?.supabaseAnonKey;

// Do NOT crash the app if missing
let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
    console.warn(
        'Supabase not initialized: missing credentials. App will still load.'
    );
}

export { supabase };
