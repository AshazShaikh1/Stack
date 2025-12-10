'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface EndpointConfig {
  method: string;
  path: string;
  category: string;
  label: string;
  requiresAuth?: boolean;
  adminOnly?: boolean;
  note?: string;
  body?: any;
  query?: any;
  pathParams?: { [key: string]: string }; // e.g., { '[id]': 'collection-id' }
  bodyFields?: { [key: string]: string }; // e.g., { 'collection_id': 'collection-id' }
}

export default function APITestPage() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Unified state for all possible inputs
  const [inputs, setInputs] = useState<{ [key: string]: string }>({
    // IDs
    'collection-id': '',
    'card-id': '',
    'user-id': '',
    'comment-id': '',
    'notification-id': '',
    'report-id': '',
    'stack-id-legacy': '',
    
    // Content Inputs
    'title': 'Test Item',
    'description': 'Created via API Test Dashboard',
    'content': 'This is a test comment or report content.',
    'url': 'https://example.com',
    'search-query': 'design',
    'reason': 'spam', // for reports
    
    // Config/Flags
    'limit': '20',
    'offset': '0',
    'is_public': 'true',
  });

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
    setLoading(endpoint.path + endpoint.method);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (endpoint.requiresAuth && !session) {
        throw new Error('You must be logged in to use this endpoint');
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // 1. Handle Path Parameters (e.g., /api/collections/[id])
      let finalPath = endpoint.path;
      if (endpoint.pathParams) {
        Object.entries(endpoint.pathParams).forEach(([placeholder, inputKey]) => {
          const value = inputs[inputKey];
          if (!value) throw new Error(`Missing required ID: ${inputKey}`);
          finalPath = finalPath.replace(placeholder, value);
        });
      }

      // 2. Handle Body Data
      let finalBody: any = null;
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        finalBody = endpoint.body ? { ...endpoint.body } : {};
        if (endpoint.bodyFields) {
          Object.entries(endpoint.bodyFields).forEach(([field, inputKey]) => {
            let value: any = inputs[inputKey];
            // Type casting for booleans/numbers if needed
            if (value === 'true') value = true;
            if (value === 'false') value = false;
            if (field === 'limit' || field === 'offset') value = parseInt(value);
            
            if (value !== undefined && value !== '') {
              finalBody[field] = value;
            }
          });
        }
      }

      // 3. Handle Query Parameters
      let finalQuery: any = null;
      if (endpoint.query) {
        finalQuery = { ...endpoint.query };
      }
      // If the endpoint is GET, map bodyFields to query params instead
      if (endpoint.method === 'GET' && endpoint.bodyFields) {
        finalQuery = finalQuery || {};
        Object.entries(endpoint.bodyFields).forEach(([field, inputKey]) => {
          if (inputs[inputKey]) finalQuery[field] = inputs[inputKey];
        });
      }

      const options: RequestInit = {
        method: endpoint.method,
        headers,
      };

      if (finalBody && Object.keys(finalBody).length > 0) {
        options.body = JSON.stringify(finalBody);
      }

      const queryString = finalQuery 
        ? '?' + new URLSearchParams(finalQuery).toString() 
        : '';
        
      const url = `/api${finalPath}${queryString}`;

      const response = await fetch(url, options);
      
      // Parse Response
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: 'Non-JSON response', text: text.substring(0, 200) };
      }

      setResults((prev: any) => ({
        ...prev,
        [`${endpoint.method} ${endpoint.path}`]: {
          status: response.status,
          data,
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
    } catch (error: any) {
      setResults((prev: any) => ({
        ...prev,
        [`${endpoint.method} ${endpoint.path}`]: {
          status: 'ERR',
          error: error.message,
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
    } finally {
      setLoading(null);
    }
  };

  // ==========================================
  // 🚀 ALL 39 ENDPOINTS CONFIGURATION
  // ==========================================
  const endpoints: EndpointConfig[] = [
    // --- 1. Collections ---
    {
      category: 'Collections', method: 'GET', path: '/collections', label: 'List Collections',
      bodyFields: { limit: 'limit', offset: 'offset', is_public: 'is_public' }
    },
    {
      category: 'Collections', method: 'POST', path: '/collections', label: 'Create Collection', requiresAuth: true,
      body: { tags: ['test-tag'] },
      bodyFields: { title: 'title', description: 'description', is_public: 'is_public' }
    },
    {
      category: 'Collections', method: 'GET', path: '/collections/[id]', label: 'Get Collection',
      pathParams: { '[id]': 'collection-id' }
    },
    {
      category: 'Collections', method: 'POST', path: '/collections/[id]/clone', label: 'Clone Collection', requiresAuth: true,
      pathParams: { '[id]': 'collection-id' }
    },

    // --- 2. Cards ---
    {
      category: 'Cards', method: 'GET', path: '/cards', label: 'List Cards',
      bodyFields: { limit: 'limit', offset: 'offset' }
    },
    {
      category: 'Cards', method: 'POST', path: '/cards', label: 'Create Card', requiresAuth: true,
      bodyFields: { title: 'title', description: 'description', url: 'url', collection_id: 'collection-id' }
    },
    {
      category: 'Cards', method: 'GET', path: '/cards/[id]', label: 'Get Card',
      pathParams: { '[id]': 'card-id' }
    },
    {
      category: 'Cards', method: 'POST', path: '/cards/metadata', label: 'Fetch Metadata',
      bodyFields: { url: 'url' }
    },
    // Note: GET /metadata seems to be a general utility separate from cards
    {
      category: 'Cards', method: 'POST', path: '/metadata', label: 'General Metadata',
      bodyFields: { url: 'url' }
    },

    // --- 3. Discovery & Search ---
    {
      category: 'Discovery', method: 'GET', path: '/feed', label: 'Get Feed',
      bodyFields: { limit: 'limit', offset: 'offset' }
    },
    {
      category: 'Discovery', method: 'GET', path: '/search', label: 'Search',
      bodyFields: { q: 'search-query' }
    },

    // --- 4. Interactions (Votes, Saves, Comments) ---
    {
      category: 'Interactions', method: 'POST', path: '/votes', label: 'Upvote (Card)', requiresAuth: true,
      body: { target_type: 'card', vote_type: 'upvote' },
      bodyFields: { target_id: 'card-id' }
    },
    {
      category: 'Interactions', method: 'POST', path: '/votes', label: 'Upvote (Collection)', requiresAuth: true,
      body: { target_type: 'collection', vote_type: 'upvote' },
      bodyFields: { target_id: 'collection-id' }
    },
    {
      category: 'Interactions', method: 'POST', path: '/saves', label: 'Save Item', requiresAuth: true,
      body: { target_type: 'card' }, // Defaulting to card, user can change logic if needed
      bodyFields: { target_id: 'card-id' }
    },
    {
      category: 'Interactions', method: 'GET', path: '/comments', label: 'Get Comments',
      bodyFields: { target_id: 'card-id' },
      query: { target_type: 'card' }
    },
    {
      category: 'Interactions', method: 'POST', path: '/comments', label: 'Post Comment', requiresAuth: true,
      body: { target_type: 'card' },
      bodyFields: { target_id: 'card-id', content: 'content' }
    },
    {
      category: 'Interactions', method: 'DELETE', path: '/comments/[id]', label: 'Delete Comment', requiresAuth: true,
      pathParams: { '[id]': 'comment-id' }
    },

    // --- 5. Social (Follows) ---
    {
      category: 'Social', method: 'POST', path: '/follows', label: 'Follow User', requiresAuth: true,
      bodyFields: { following_id: 'user-id' }
    },
    {
      category: 'Social', method: 'DELETE', path: '/follows/[id]', label: 'Unfollow User', requiresAuth: true,
      pathParams: { '[id]': 'user-id' }
    },
    {
      category: 'Social', method: 'GET', path: '/follows/check/[id]', label: 'Check Follow', requiresAuth: true,
      pathParams: { '[id]': 'user-id' }
    },

    // --- 6. Notifications ---
    {
      category: 'Notifications', method: 'GET', path: '/notifications', label: 'List Notifications', requiresAuth: true
    },
    {
      category: 'Notifications', method: 'GET', path: '/notifications/unread-count', label: 'Unread Count', requiresAuth: true
    },
    {
      category: 'Notifications', method: 'POST', path: '/notifications/read-all', label: 'Mark All Read', requiresAuth: true
    },
    {
      category: 'Notifications', method: 'PATCH', path: '/notifications/[id]', label: 'Mark One Read', requiresAuth: true,
      pathParams: { '[id]': 'notification-id' }
    },

    // --- 7. Admin & Workers (Background Jobs) ---
    {
      category: 'Admin', method: 'POST', path: '/admin/refresh-ranking', label: 'Refresh Ranking', requiresAuth: true, adminOnly: true
    },
    {
      category: 'Admin', method: 'POST', path: '/workers/check-links', label: 'Worker: Check Links', requiresAuth: true, adminOnly: true
    },
    {
      category: 'Admin', method: 'POST', path: '/workers/fetch-metadata', label: 'Worker: Fetch Metadata', requiresAuth: true, adminOnly: true
    },
    {
      category: 'Admin', method: 'POST', path: '/workers/fraud-detection', label: 'Worker: Fraud Detection', requiresAuth: true, adminOnly: true
    },
    {
      category: 'Admin', method: 'POST', path: '/workers/ranking', label: 'Worker: Main Ranking', requiresAuth: true, adminOnly: true
    },
    {
      category: 'Admin', method: 'POST', path: '/workers/ranking/delta', label: 'Worker: Delta Ranking', requiresAuth: true, adminOnly: true
    },
    {
      category: 'Admin', method: 'POST', path: '/workers/ranking/recompute', label: 'Worker: Recompute', requiresAuth: true, adminOnly: true
    },
    {
      category: 'Admin', method: 'GET', path: '/monitoring/check-alerts', label: 'Check Alerts', requiresAuth: true
    },

    // --- 8. Reports & Moderation ---
    {
      category: 'Moderation', method: 'POST', path: '/reports', label: 'Create Report', requiresAuth: true,
      body: { target_type: 'card' },
      bodyFields: { target_id: 'card-id', reason: 'reason' }
    },
    {
      category: 'Moderation', method: 'GET', path: '/reports/[id]', label: 'Get Report', requiresAuth: true, adminOnly: true,
      pathParams: { '[id]': 'report-id' }
    },

    // --- 9. Users & Payments ---
    {
      category: 'Users', method: 'POST', path: '/users/become-stacker', label: 'Become Stacker', requiresAuth: true
    },
    {
      category: 'Users', method: 'GET', path: '/stacker/analytics', label: 'Stacker Analytics', requiresAuth: true
    },
    {
      category: 'Users', method: 'POST', path: '/payments/checkout', label: 'Stripe Checkout', requiresAuth: true,
      body: { priceId: 'price_fake_id' }
    },

    // --- 10. Legacy (Stacks) ---
    {
      category: 'Legacy', method: 'GET', path: '/stacks', label: 'List Stacks (Legacy)',
      note: 'Use /collections instead if possible'
    },
    {
      category: 'Legacy', method: 'GET', path: '/stacks/[id]', label: 'Get Stack (Legacy)',
      pathParams: { '[id]': 'stack-id-legacy' }
    },
    {
      category: 'Legacy', method: 'POST', path: '/stacks/[id]/clone', label: 'Clone Stack (Legacy)', requiresAuth: true,
      pathParams: { '[id]': 'stack-id-legacy' }
    },
  ];

  const categories = Array.from(new Set(endpoints.map(e => e.category)));

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-jet-dark">API Test Dashboard</h1>
        <div className={`px-4 py-2 rounded-full text-sm font-medium ${isAuthenticated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
        </div>
      </div>

      {/* Input Grid */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-jet-dark">Test Data Inputs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(inputs).map(([key, value]) => (
            <div key={key} className="flex flex-col">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1">{key.replace(/-/g, ' ')}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => updateInput(key, e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder={`Enter ${key}...`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
        <button
          onClick={() => setActiveCategory('All')}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeCategory === 'All' ? 'bg-jet text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Endpoints
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat ? 'bg-jet text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Endpoints List */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {endpoints
          .filter(e => activeCategory === 'All' || e.category === activeCategory)
          .map((endpoint, idx) => {
            const resultKey = `${endpoint.method} ${endpoint.path}`;
            const result = results[resultKey];

            return (
              <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-500/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                      endpoint.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                      endpoint.method === 'POST' ? 'bg-green-100 text-green-700' :
                      endpoint.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {endpoint.method}
                    </span>
                    <div>
                      <h3 className="font-semibold text-jet-dark">{endpoint.label}</h3>
                      <p className="text-xs text-gray-500 font-mono">{endpoint.path}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => testEndpoint(endpoint)}
                    disabled={loading === endpoint.path + endpoint.method}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      loading === endpoint.path + endpoint.method
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-jet text-white hover:bg-emerald-600 shadow-sm'
                    }`}
                  >
                    {loading === endpoint.path + endpoint.method ? 'Testing...' : 'Run Test'}
                  </button>
                </div>

                {/* Flags/Tags */}
                <div className="flex gap-2 mb-3">
                  {endpoint.requiresAuth && (
                    <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100">
                      Auth Required
                    </span>
                  )}
                  {endpoint.adminOnly && (
                    <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">
                      Admin
                    </span>
                  )}
                  {endpoint.category && (
                    <span className="text-[10px] bg-gray-50 text-gray-600 px-2 py-0.5 rounded border border-gray-100">
                      {endpoint.category}
                    </span>
                  )}
                </div>

                {/* Result Area */}
                {result && (
                  <div className={`mt-4 rounded-lg p-3 text-xs font-mono overflow-hidden ${
                    result.status === 200 || result.status === 201 ? 'bg-green-50/50 border border-green-100' : 'bg-red-50/50 border border-red-100'
                  }`}>
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200/50">
                      <span className={`font-bold ${
                        result.status === 200 || result.status === 201 ? 'text-green-700' : 'text-red-700'
                      }`}>
                        Status: {result.status}
                      </span>
                      <span className="text-gray-400">{result.timestamp}</span>
                    </div>
                    <pre className="overflow-x-auto max-h-[200px] text-gray-700">
                      {JSON.stringify(result.data || result.error, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}