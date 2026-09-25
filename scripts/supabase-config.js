/**
 * Supabase client configuration for frontend & admin.
 * Replace with your project details or update window.SUPABASE_CONFIG dynamically.
 */
(function (global) {
  'use strict';

  global.SUPABASE_CONFIG = {
    url: 'https://YOUR_PROJECT_ID.supabase.co',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
    storageBucket: 'portfolio-media'
  };

  // Helper to get initialized Supabase client if @supabase/supabase-js is loaded
  global.getSupabaseClient = function () {
    if (!global.supabase || !global.supabase.createClient) {
      console.warn('Supabase SDK not loaded yet.');
      return null;
    }
    if (!global._supabaseInstance) {
      global._supabaseInstance = global.supabase.createClient(
        global.SUPABASE_CONFIG.url,
        global.SUPABASE_CONFIG.anonKey
      );
    }
    return global._supabaseInstance;
  };
})(typeof window !== 'undefined' ? window : globalThis);
