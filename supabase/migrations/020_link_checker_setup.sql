-- ============================================
-- Link Checker Setup
-- ============================================
-- This sets up a function that can be called by pg_cron to trigger link checks
-- Note: This requires the http extension and pg_net extension (Supabase Edge Functions)
-- For simpler setup, use GitHub Actions workflow instead

-- Create a function to call the link checker API
-- This uses pg_net (Supabase's HTTP extension)
CREATE OR REPLACE FUNCTION trigger_link_checker()
RETURNS void AS $$
DECLARE
  app_url text;
  api_key text;
  response_status int;
BEGIN
  -- Get app URL and API key from environment (set in Supabase secrets)
  -- For now, we'll use a placeholder - you need to set these in Supabase Dashboard
  app_url := current_setting('app.link_checker_url', true);
  api_key := current_setting('app.worker_api_key', true);
  
  -- If not set, use defaults (you should set these in Supabase)
  IF app_url IS NULL THEN
    app_url := 'http://localhost:3000';
  END IF;
  
  -- Call the link checker API
  -- Note: This requires pg_net extension which may not be available
  -- For production, use GitHub Actions workflow instead
  PERFORM net.http_post(
    url := app_url || '/api/workers/check-links?limit=50',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-api-key', COALESCE(api_key, '')
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    RAISE WARNING 'Failed to trigger link checker: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Note: To use this with pg_cron, you would schedule it like:
-- SELECT cron.schedule('check-links', '0 */6 * * *', 'SELECT trigger_link_checker();');
-- 
-- However, for MVP, we recommend using GitHub Actions workflow instead:
-- See .github/workflows/check-links.yml

