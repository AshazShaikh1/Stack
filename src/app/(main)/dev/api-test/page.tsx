'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface EndpointConfig {
  method: string;
  path: string;
  label: string;
  requiresAuth?: boolean;
  note?: string;
  body?: any;
  query?: any;
  pathParams?: { [key: string]: string }; // e.g., { '[id]': 'stack-id-input' }
  bodyFields?: { [key: string]: string }; // e.g., { 'stack_id': 'stack-id-input' }
}

export default function APITestPage() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [inputs, setInputs] = useState<{ [key: string]: string }>({
    'stack-id': '',
    'card-id': '',
    'user-id': '',
    'comment-id': '',
    'notification-id': '',
    'report-id': '',
    'stack-id-input': '',
    'card-id-input': '',
    'url-input': 'https://example.com',
    'title-input': 'Test Title',
    'description-input': 'Test Description',
    'content-input': 'Test comment content',
    'search-query': 'test',
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();
  }, []);

  const updateInput = (key: string, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const testEndpoint = async (endpoint: EndpointConfig) => {
    setLoading(endpoint.path);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (endpoint.requiresAuth && !session) {
        setResults((prev: any) => ({
          ...prev,
          [endpoint.path]: {
            method: endpoint.method,
            error: 'You must be logged in to use this endpoint',
            timestamp: new Date().toISOString(),
          },
        }));
        setLoading(null);
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Build path with replacements
      let finalPath = endpoint.path;
      if (endpoint.pathParams) {
        Object.entries(endpoint.pathParams).forEach(([placeholder, inputKey]) => {
          const value = inputs[inputKey];
          if (value) {
            finalPath = finalPath.replace(placeholder, value);
          } else {
            throw new Error(`Missing required parameter: ${inputKey}`);
          }
        });
      }

      // Build body with replacements
      let finalBody: any = null;
      if (endpoint.bodyFields || endpoint.body) {
        // Start with endpoint.body if it exists, otherwise empty object
        finalBody = endpoint.body ? { ...endpoint.body } : {};
        
        // Add values from input fields
        if (endpoint.bodyFields) {
          Object.entries(endpoint.bodyFields).forEach(([field, inputKey]) => {
            const value = inputs[inputKey];
            // Include value if it exists (even empty string - let API validate)
            if (value !== undefined && value !== null) {
              finalBody[field] = value.trim ? value.trim() : value;
            }
          });
        }
      }

      // Build query params
      let finalQuery: any = null;
      if (endpoint.query) {
        finalQuery = { ...endpoint.query };
        // Replace any query params that reference inputs
        if (endpoint.bodyFields) {
          Object.entries(endpoint.bodyFields).forEach(([field, inputKey]) => {
            const value = inputs[inputKey];
            if (value !== undefined && value !== null && value !== '') {
              finalQuery[field] = value;
            }
          });
        }
      }

      const options: RequestInit = {
        method: endpoint.method,
        headers,
      };

      // Send body for POST/PATCH/PUT requests
      if (endpoint.method !== 'GET' && finalBody) {
        options.body = JSON.stringify(finalBody);
      }

      const url = endpoint.method === 'GET' && finalQuery
        ? `/api${finalPath}?${new URLSearchParams(finalQuery as any).toString()}`
        : `/api${finalPath}`;

      const response = await fetch(url, options);
      
      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = { error: `Invalid JSON response: ${text.substring(0, 100)}` };
          }
        } else {
          data = { error: 'Empty response' };
        }
      } else {
        const text = await response.text();
        data = { error: `Expected JSON but got ${contentType || 'unknown'}: ${text.substring(0, 200)}` };
      }

      setResults((prev: any) => ({
        ...prev,
        [endpoint.path]: {
          method: endpoint.method,
          status: response.status,
          data,
          timestamp: new Date().toISOString(),
        },
      }));
    } catch (error: any) {
      setResults((prev: any) => ({
        ...prev,
        [endpoint.path]: {
          method: endpoint.method,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      }));
    } finally {
      setLoading(null);
    }
  };

  const endpoints: EndpointConfig[] = [
    // Stacks
    { 
      method: 'GET', 
      path: '/stacks/[id]', 
      label: 'Get Stack', 
      requiresAuth: false,
      pathParams: { '[id]': 'stack-id' }
    },
    { 
      method: 'POST', 
      path: '/stacks', 
      label: 'Create Collection', 
      requiresAuth: true,
      body: { is_public: true, is_hidden: false },
      bodyFields: { title: 'title-input', description: 'description-input' }
    },
    
    // Cards
    { 
      method: 'GET', 
      path: '/cards/[id]', 
      label: 'Get Card', 
      requiresAuth: false,
      pathParams: { '[id]': 'card-id' }
    },
    { 
      method: 'POST', 
      path: '/cards', 
      label: 'Create Card', 
      requiresAuth: true,
      body: {},
      bodyFields: { url: 'url-input', title: 'title-input', description: 'description-input', stack_id: 'stack-id-input' }
    },
    { 
      method: 'POST', 
      path: '/cards/metadata', 
      label: 'Get Card Metadata', 
      requiresAuth: false,
      body: {},
      bodyFields: { url: 'url-input' }
    },
    
    // Comments
    { 
      method: 'GET', 
      path: '/comments', 
      label: 'Get Comments', 
      requiresAuth: false,
      query: { target_type: 'stack' },
      bodyFields: { 'target_id': 'stack-id-input' }
    },
    { 
      method: 'POST', 
      path: '/comments', 
      label: 'Create Comment', 
      requiresAuth: true,
      body: { target_type: 'stack' },
      bodyFields: { target_id: 'stack-id-input', content: 'content-input' }
    },
    
    // Votes
    { 
      method: 'POST', 
      path: '/votes', 
      label: 'Vote', 
      requiresAuth: true,
      body: { target_type: 'stack', vote_type: 'upvote' },
      bodyFields: { target_id: 'stack-id-input' }
    },
    
    // Follows
    { 
      method: 'POST', 
      path: '/follows', 
      label: 'Follow User', 
      requiresAuth: true,
      body: {},
      bodyFields: { following_id: 'user-id' }
    },
    { 
      method: 'GET', 
      path: '/follows/check/[id]', 
      label: 'Check Follow Status', 
      requiresAuth: true,
      pathParams: { '[id]': 'user-id' }
    },
    
    // Notifications
    { 
      method: 'GET', 
      path: '/notifications', 
      label: 'Get Notifications', 
      requiresAuth: true
    },
    { 
      method: 'GET', 
      path: '/notifications/unread-count', 
      label: 'Get Unread Count', 
      requiresAuth: true
    },
    { 
      method: 'POST', 
      path: '/notifications/read-all', 
      label: 'Mark All as Read', 
      requiresAuth: true
    },
    
    // Search
    { 
      method: 'GET', 
      path: '/search', 
      label: 'Search', 
      requiresAuth: false,
      query: { type: 'all' },
      bodyFields: { 'q': 'search-query' }
    },
    
    // Metadata
    { 
      method: 'POST', 
      path: '/metadata', 
      label: 'Get Metadata', 
      requiresAuth: false,
      body: {},
      bodyFields: { url: 'url-input' }
    },
    
    // Admin
    { 
      method: 'POST', 
      path: '/admin/refresh-ranking', 
      label: 'Refresh Ranking', 
      requiresAuth: true
    },
  ];

  return (
    <div className="container mx-auto px-page py-8">
      <h1 className="text-h1 font-bold text-jet-dark mb-6">API Endpoints Test Page</h1>
      
      {/* Auth Status */}
      <div className={`mb-6 p-4 rounded-lg ${isAuthenticated ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <p className="text-body font-medium">
          {isAuthenticated ? '✅ You are logged in' : '⚠️ You are not logged in - Some endpoints require authentication'}
        </p>
      </div>

      {/* Input Fields */}
      <div className="mb-8 p-4 bg-gray-light rounded-lg">
        <h2 className="text-h2 font-semibold text-jet-dark mb-4">Input Values</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-small font-medium text-jet-dark mb-1">Stack ID</label>
            <input
              type="text"
              value={inputs['stack-id']}
              onChange={(e) => updateInput('stack-id', e.target.value)}
              placeholder="Enter stack UUID"
              className="w-full px-3 py-2 border border-gray-light rounded-md text-body"
            />
          </div>
          <div>
            <label className="block text-small font-medium text-jet-dark mb-1">Stack ID (for body)</label>
            <input
              type="text"
              value={inputs['stack-id-input']}
              onChange={(e) => updateInput('stack-id-input', e.target.value)}
              placeholder="Enter stack UUID"
              className="w-full px-3 py-2 border border-gray-light rounded-md text-body"
            />
          </div>
          <div>
            <label className="block text-small font-medium text-jet-dark mb-1">Card ID</label>
            <input
              type="text"
              value={inputs['card-id']}
              onChange={(e) => updateInput('card-id', e.target.value)}
              placeholder="Enter card UUID"
              className="w-full px-3 py-2 border border-gray-light rounded-md text-body"
            />
          </div>
          <div>
            <label className="block text-small font-medium text-jet-dark mb-1">User ID</label>
            <input
              type="text"
              value={inputs['user-id']}
              onChange={(e) => updateInput('user-id', e.target.value)}
              placeholder="Enter user UUID"
              className="w-full px-3 py-2 border border-gray-light rounded-md text-body"
            />
          </div>
          <div>
            <label className="block text-small font-medium text-jet-dark mb-1">URL</label>
            <input
              type="text"
              value={inputs['url-input']}
              onChange={(e) => updateInput('url-input', e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-gray-light rounded-md text-body"
            />
          </div>
          <div>
            <label className="block text-small font-medium text-jet-dark mb-1">Title</label>
            <input
              type="text"
              value={inputs['title-input']}
              onChange={(e) => updateInput('title-input', e.target.value)}
              placeholder="Test Title"
              className="w-full px-3 py-2 border border-gray-light rounded-md text-body"
            />
          </div>
          <div>
            <label className="block text-small font-medium text-jet-dark mb-1">Description</label>
            <input
              type="text"
              value={inputs['description-input']}
              onChange={(e) => updateInput('description-input', e.target.value)}
              placeholder="Test Description"
              className="w-full px-3 py-2 border border-gray-light rounded-md text-body"
            />
          </div>
          <div>
            <label className="block text-small font-medium text-jet-dark mb-1">Content/Comment</label>
            <input
              type="text"
              value={inputs['content-input']}
              onChange={(e) => updateInput('content-input', e.target.value)}
              placeholder="Test comment"
              className="w-full px-3 py-2 border border-gray-light rounded-md text-body"
            />
          </div>
          <div>
            <label className="block text-small font-medium text-jet-dark mb-1">Search Query</label>
            <input
              type="text"
              value={inputs['search-query']}
              onChange={(e) => updateInput('search-query', e.target.value)}
              placeholder="test"
              className="w-full px-3 py-2 border border-gray-light rounded-md text-body"
            />
          </div>
        </div>
      </div>

      <p className="text-body text-gray-muted mb-8">
        Fill in the input values above (if needed), then click "Test" on any endpoint below.
      </p>

      <div className="space-y-4">
        {endpoints.map((endpoint, idx) => (
          <div key={idx} className="border border-gray-light rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-block px-2 py-1 text-white text-xs font-mono rounded ${
                  endpoint.method === 'GET' ? 'bg-blue-600' :
                  endpoint.method === 'POST' ? 'bg-green-600' :
                  endpoint.method === 'PATCH' ? 'bg-yellow-600' :
                  endpoint.method === 'DELETE' ? 'bg-red-600' : 'bg-gray-600'
                }`}>
                  {endpoint.method}
                </span>
                <span className="text-body font-mono text-jet-dark">{endpoint.path}</span>
                <span className="text-body font-medium text-jet-dark">{endpoint.label}</span>
                {endpoint.requiresAuth && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Auth Required</span>
                )}
              </div>
              <button
                onClick={() => testEndpoint(endpoint)}
                disabled={loading === endpoint.path}
                className="px-4 py-2 bg-jet text-white rounded-md hover:bg-jet-dark disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading === endpoint.path ? 'Testing...' : 'Test'}
              </button>
            </div>
            {endpoint.note && (
              <p className="text-small text-gray-muted mb-2">{endpoint.note}</p>
            )}
            {(endpoint.body || endpoint.query || endpoint.bodyFields) && (
              <div className="mt-2">
                {endpoint.bodyFields && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-muted mb-1">Required Fields (fill in inputs above):</p>
                    <div className="text-xs bg-yellow-50 border border-yellow-200 p-2 rounded">
                      {Object.entries(endpoint.bodyFields).map(([field, inputKey]) => (
                        <div key={field} className="mb-1">
                          <span className="font-mono font-semibold">{field}:</span>{' '}
                          <span className={inputs[inputKey] ? 'text-green-600' : 'text-red-600'}>
                            {inputs[inputKey] || '(empty - fill in input field)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {endpoint.body && Object.keys(endpoint.body).length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-muted mb-1">Static Body Values:</p>
                    <pre className="text-xs bg-gray-light p-2 rounded overflow-x-auto">
                      {JSON.stringify(endpoint.body, null, 2)}
                    </pre>
                  </div>
                )}
                {endpoint.query && (
                  <div>
                    <p className="text-xs text-gray-muted mb-1">Query Params:</p>
                    <pre className="text-xs bg-gray-light p-2 rounded overflow-x-auto">
                      {JSON.stringify(endpoint.query, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {results[endpoint.path] && (
              <div className="mt-3 p-3 bg-gray-light rounded">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold ${
                    results[endpoint.path].status >= 200 && results[endpoint.path].status < 300
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    Status: {results[endpoint.path].status || 'Error'}
                  </span>
                  <span className="text-xs text-gray-muted">
                    {results[endpoint.path].timestamp}
                  </span>
                </div>
                <pre className="text-xs overflow-x-auto max-h-96">
                  {JSON.stringify(results[endpoint.path].data || results[endpoint.path].error, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-jet/5 rounded-lg">
        <h2 className="text-h2 font-semibold text-jet-dark mb-2">Quick Reference</h2>
        <p className="text-body text-gray-muted mb-4">
          For a complete API reference, see <code className="bg-gray-light px-2 py-1 rounded">Docs/API_Endpoints.md</code>
        </p>
        <div className="space-y-2 text-small">
          <p><strong>Base URL:</strong> <code className="bg-gray-light px-2 py-1 rounded">http://localhost:3000/api</code></p>
          <p><strong>Authentication:</strong> Most endpoints require a valid Supabase session cookie</p>
          <p><strong>Rate Limits:</strong> Some endpoints have rate limiting (see docs)</p>
        </div>
      </div>
    </div>
  );
}
