/**
 * Supabase client configuration for frontend & admin.
 * Replace with your project details or update window.SUPABASE_CONFIG dynamically.
 */
(function (global) {
  'use strict';

  global.SUPABASE_CONFIG = {
    url: 'https://wsxeyfgtrikijkijnbyz.supabase.co',
    anonKey: 'sb_publishable_f33IqfP7v610QPzWAWYv-w_jcYu5dlT',
    storageBucket: 'portfolio-media'
  };

  // Helper to get initialized Supabase client if @supabase/supabase-js is loaded
  global.getSupabaseClient = function () {
    if (!global.supabase || !global.supabase.createClient) {
      return null;
    }
    if (!global._supabaseInstance) {
      try {
        global._supabaseInstance = global.supabase.createClient(
          global.SUPABASE_CONFIG.url,
          global.SUPABASE_CONFIG.anonKey
        );
      } catch (err) {
        console.warn('Supabase initialization failed:', err);
        return null;
      }
    }
    return global._supabaseInstance;
  };

  // Helper to resolve Supabase Storage URLs safely
  global.getSupabaseMediaUrl = function (path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
    var client = global.getSupabaseClient();
    if (!client || !client.storage) return path;
    try {
      var clean = path.replace(/\\/g, '/').replace(/^\/+/, '');
      var bucket = global.SUPABASE_CONFIG.storageBucket || 'portfolio-media';
      var res = client.storage.from(bucket).getPublicUrl(clean);
      return res && res.data && res.data.publicUrl ? res.data.publicUrl : path;
    } catch (_) {
      return path;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
