'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Endpoint {
  method: string;
  path: string;
  description: string;
  requiresAuth: boolean;
  body?: Record<string, any>;
  queryParams?: Record<string, string>;
  pathParam?: string;
}

export default function ApiTestPage() {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const endpoints: Endpoint[] = [
    // Cards
    {
      method: 'POST',
      path: '/api/cards',
      description: 'Create a new card',
      requiresAuth: true,
      body: {
        url: 'https://example.com',
        stack_id: 'stack-id-here',
      },
    },
    {
      method: 'GET',
      path: '/api/cards/metadata',
      description: 'Fetch metadata from URL',
      requiresAuth: false,
      queryParams: {
        url: 'https://example.com',
      },
    },
    // Votes
    {
      method: 'POST',
      path: '/api/votes',
      description: 'Toggle upvote on stack/card',
      requiresAuth: true,
      body: {
        target_type: 'stack',
        target_id: 'target-id-here',
      },
    },
    // Comments
    {
      method: 'GET',
      path: '/api/comments',
      description: 'Get comments for stack/card',
      requiresAuth: false,
      queryParams: {
        target_type: 'stack',
        target_id: 'target-id-here',
      },
    },
    {
      method: 'POST',
      path: '/api/comments',
      description: 'Create a comment',
      requiresAuth: true,
      body: {
        target_type: 'stack',
        target_id: 'target-id-here',
        content: 'Test comment',
        parent_id: null,
      },
    },
    // Search
    {
      method: 'GET',
      path: '/api/search',
      description: 'Search stacks, cards, users',
      requiresAuth: false,
      queryParams: {
        q: 'test',
        type: 'all',
      },
    },
    // Follows
    {
      method: 'POST',
      path: '/api/follows',
      description: 'Follow a user',
      requiresAuth: true,
      body: {
        following_id: 'user-id-here',
      },
    },
    {
      method: 'GET',
      path: '/api/follows/check/[id]',
      description: 'Check if following user',
      requiresAuth: true,
      pathParam: 'user-id-here',
    },
    {
      method: 'DELETE',
      path: '/api/follows/[id]',
      description: 'Unfollow a user',
      requiresAuth: true,
      pathParam: 'user-id-here',
    },
    // Reports
    {
      method: 'GET',
      path: '/api/reports',
      description: 'Get reports (admin only)',
      requiresAuth: true,
      queryParams: {
        status: 'open',
        limit: '50',
      },
    },
    {
      method: 'POST',
      path: '/api/reports',
      description: 'Create a report',
      requiresAuth: true,
      body: {
        target_type: 'stack',
        target_id: 'target-id-here',
        reason: 'spam',
      },
    },
    {
      method: 'PATCH',
      path: '/api/reports/[id]',
      description: 'Update report status (admin only)',
      requiresAuth: true,
      pathParam: 'report-id-here',
      body: {
        status: 'resolved',
      },
    },
    // Stacks Clone
    {
      method: 'POST',
      path: '/api/stacks/[id]/clone',
      description: 'Clone a stack',
      requiresAuth: true,
      pathParam: 'stack-id-here',
    },
    // Payments
    {
      method: 'POST',
      path: '/api/payments/checkout',
      description: 'Create Stripe checkout session',
      requiresAuth: true,
      body: {
        type: 'promote',
        duration: '7days',
        stack_id: 'stack-id-here',
      },
    },
    // Admin
    {
      method: 'POST',
      path: '/api/admin/refresh-ranking',
      description: 'Refresh explore ranking',
      requiresAuth: true,
    },
    // Workers
    {
      method: 'POST',
      path: '/api/workers/check-links',
      description: 'Check link health (worker)',
      requiresAuth: false,
      queryParams: {
        limit: '10',
      },
    },
  ];

  const callEndpoint = async (endpoint: Endpoint) => {
    const key = `${endpoint.method}-${endpoint.path}`;
    setLoading(prev => ({ ...prev, [key]: true }));

    try {
      let url = endpoint.path;
      
      // Replace path params
      if (endpoint.pathParam && url.includes('[id]')) {
        url = url.replace('[id]', endpoint.pathParam);
      }

      // Add query params
      if (endpoint.queryParams) {
        const params = new URLSearchParams(endpoint.queryParams);
        url += `?${params.toString()}`;
      }

      const options: RequestInit = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // Add body for POST/PATCH
      if (endpoint.body && (endpoint.method === 'POST' || endpoint.method === 'PATCH')) {
        options.body = JSON.stringify(endpoint.body);
      }

      // Get auth token from Supabase
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (endpoint.requiresAuth && session?.access_token) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${session.access_token}`,
        };
      }

      const response = await fetch(url, options);
      const data = await response.json();

      setResults(prev => ({
        ...prev,
        [key]: {
          status: response.status,
          statusText: response.statusText,
          data,
          timestamp: new Date().toISOString(),
        },
      }));
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        [key]: {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="container mx-auto px-page py-section">
      <div className="mb-8">
        <h1 className="text-h1 font-bold text-jet-dark mb-2">API Test Page (Dev Only)</h1>
        <p className="text-body text-gray-muted mb-4">
          Test all API endpoints. Make sure you're logged in for authenticated endpoints.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This page is for development only. Replace placeholder IDs (like 'stack-id-here') 
            with actual IDs from your database before testing.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {endpoints.map((endpoint, index) => {
          const key = `${endpoint.method}-${endpoint.path}`;
          const result = results[key];
          const isLoading = loading[key];

          return (
            <div key={index} className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                      endpoint.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                      endpoint.method === 'POST' ? 'bg-green-100 text-green-800' :
                      endpoint.method === 'PATCH' ? 'bg-yellow-100 text-yellow-800' :
                      endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {endpoint.method}
                    </span>
                    <code className="text-sm font-mono text-jet-dark">{endpoint.path}</code>
                    {endpoint.requiresAuth && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                        Auth Required
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-muted">{endpoint.description}</p>
                </div>
                <Button
                  onClick={() => callEndpoint(endpoint)}
                  disabled={isLoading}
                  size="sm"
                  variant="primary"
                >
                  {isLoading ? 'Testing...' : 'Test'}
                </Button>
              </div>

              {(endpoint.body || endpoint.queryParams) && (
                <div className="mb-4 p-3 bg-gray-50 rounded text-xs">
                  <strong>Request:</strong>
                  <pre className="mt-1 text-xs overflow-x-auto">
                    {endpoint.body && (
                      <>
                        <strong>Body:</strong>
                        {JSON.stringify(endpoint.body, null, 2)}
                      </>
                    )}
                    {endpoint.queryParams && (
                      <>
                        <strong>Query Params:</strong>
                        {JSON.stringify(endpoint.queryParams, null, 2)}
                      </>
                    )}
                    {endpoint.pathParam && (
                      <>
                        <strong>Path Param:</strong> {endpoint.pathParam}
                      </>
                    )}
                  </pre>
                </div>
              )}

              {result && (
                <div className={`p-3 rounded text-xs ${
                  result.error ? 'bg-red-50 border border-red-200' :
                  result.status >= 400 ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-green-50 border border-green-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <strong>Response:</strong>
                    {result.status && (
                      <span className={`px-2 py-1 rounded ${
                        result.status >= 400 ? 'bg-red-200 text-red-800' :
                        'bg-green-200 text-green-800'
                      }`}>
                        {result.status} {result.statusText}
                      </span>
                    )}
                  </div>
                  <pre className="overflow-x-auto text-xs">
                    {JSON.stringify(result.data || result, null, 2)}
                  </pre>
                  {result.timestamp && (
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(result.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

