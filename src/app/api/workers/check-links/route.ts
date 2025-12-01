import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/api-service';

/**
 * POST /api/workers/check-links
 * Link health checker worker
 * Checks a batch of links and updates link_checks table
 * 
 * Query params:
 * - limit: number of links to check (default: 50)
 * - batch: batch identifier for idempotency
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add API key authentication for security
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = process.env.WORKER_API_KEY;
    
    if (expectedApiKey && apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const batchId = searchParams.get('batch') || `batch-${Date.now()}`;

    // Get cards that need checking
    // Priority: cards that haven't been checked recently, or have broken status
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select(`
        id,
        canonical_url,
        status,
        link_checks (
          id,
          last_checked_at,
          status,
          attempts
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
      return NextResponse.json(
        { error: 'Failed to fetch cards' },
        { status: 500 }
      );
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        message: 'No cards to check',
      });
    }

    const results = {
      checked: 0,
      ok: 0,
      broken: 0,
      redirect: 0,
      timeout: 0,
      errors: 0,
    };

    // Check each link
    for (const card of cards) {
      try {
        const checkResult = await checkLink(card.canonical_url);
        const linkCheck = card.link_checks?.[0];

        // Update or create link_check record
        const linkCheckData = {
          card_id: card.id,
          last_checked_at: new Date().toISOString(),
          status: checkResult.status,
          status_code: checkResult.statusCode,
          redirect_url: checkResult.redirectUrl,
          response_time_ms: checkResult.responseTime,
          attempts: (linkCheck?.attempts || 0) + 1,
          metadata: {
            batch_id: batchId,
            user_agent: checkResult.userAgent,
            checked_at: new Date().toISOString(),
          },
        };

        if (linkCheck) {
          // Update existing record
          await supabase
            .from('link_checks')
            .update(linkCheckData)
            .eq('id', linkCheck.id);
        } else {
          // Create new record
          await supabase
            .from('link_checks')
            .insert(linkCheckData);
        }

        // Update card status if broken
        if (checkResult.status === 'broken') {
          await supabase
            .from('cards')
            .update({ status: 'broken' })
            .eq('id', card.id);
        } else if (card.status === 'broken' && checkResult.status === 'ok') {
          // Restore card if link is fixed
          await supabase
            .from('cards')
            .update({ status: 'active' })
            .eq('id', card.id);
        }

        results.checked++;
        results[checkResult.status as keyof typeof results]++;
      } catch (error: any) {
        console.error(`Error checking link for card ${card.id}:`, error);
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      ...results,
    });
  } catch (error: any) {
    console.error('Error in link checker worker:', error);
    return NextResponse.json(
      { error: error.message || 'Link checker failed' },
      { status: 500 }
    );
  }
}

interface LinkCheckResult {
  status: 'ok' | 'broken' | 'redirect' | 'timeout';
  statusCode?: number;
  redirectUrl?: string;
  responseTime: number;
  userAgent: string;
}

async function checkLink(url: string): Promise<LinkCheckResult> {
  const startTime = Date.now();
  const timeout = 10000; // 10 seconds
  const userAgent = 'Stack-LinkChecker/1.0';

  try {
    // Try HEAD request first (lighter)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': userAgent,
        },
        signal: controller.signal,
        redirect: 'manual', // Don't follow redirects automatically
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // Handle redirects
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        return {
          status: 'redirect',
          statusCode: response.status,
          redirectUrl: location || undefined,
          responseTime,
          userAgent,
        };
      }

      // Check if status is OK
      if (response.ok) {
        return {
          status: 'ok',
          statusCode: response.status,
          responseTime,
          userAgent,
        };
      }

      // If HEAD fails, try GET
      if (response.status >= 400) {
        const getController = new AbortController();
        const getTimeoutId = setTimeout(() => getController.abort(), timeout);

        try {
          const getResponse = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': userAgent,
            },
            signal: getController.signal,
            redirect: 'manual',
          });

          clearTimeout(getTimeoutId);
          const getResponseTime = Date.now() - startTime;

          if (getResponse.ok) {
            return {
              status: 'ok',
              statusCode: getResponse.status,
              responseTime: getResponseTime,
              userAgent,
            };
          }

          return {
            status: 'broken',
            statusCode: getResponse.status,
            responseTime: getResponseTime,
            userAgent,
          };
        } catch (getError) {
          clearTimeout(getTimeoutId);
          return {
            status: 'broken',
            statusCode: response.status,
            responseTime: Date.now() - startTime,
            userAgent,
          };
        }
      }

      return {
        status: 'broken',
        statusCode: response.status,
        responseTime,
        userAgent,
      };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return {
          status: 'timeout',
          responseTime: timeout,
          userAgent,
        };
      }

      throw fetchError;
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    // Network errors, DNS failures, etc.
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return {
        status: 'timeout',
        responseTime,
        userAgent,
      };
    }

    return {
      status: 'broken',
      responseTime,
      userAgent,
    };
  }
}

