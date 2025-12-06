'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

interface StackerDashboardProps {
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    role: string;
  };
}

interface AnalyticsData {
  overview: {
    collections: number;
    cards: number;
    upvotes: number;
    saves: number;
    comments: number;
    views: number;
  };
  timeSeries: {
    collections: Array<{ date: string; value: number }>;
    cards: Array<{ date: string; value: number }>;
    upvotes: Array<{ date: string; value: number }>;
    saves: Array<{ date: string; value: number }>;
    comments: Array<{ date: string; value: number }>;
    views: Array<{ date: string; value: number }>;
  };
  topCollections: Array<{
    id: string;
    title: string;
    slug: string;
    stats: any;
    engagement: number;
  }>;
  topCards: Array<{
    id: string;
    title: string;
    url: string;
    upvotes: number;
    saves: number;
    comments: number;
    engagement: number;
  }>;
  engagement: {
    totalEngagement: number;
    avgEngagementPerCollection: number;
    collectionsCount: number;
  };
}

const CHART_COLORS = {
  primary: '#1DB954', // Emerald
  primaryDark: '#1AA34A',
  primaryLight: '#1ED760',
  secondary: '#312F2C', // Jet
  accent: '#555555', // Gray muted
};

export function StackerDashboard({ user }: StackerDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/stacker/analytics?days=${days}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      
      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-page py-section">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-page py-section">
        <Card className="p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchAnalytics} variant="primary">
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  // Format dates for charts (show month/day)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const engagementData = [
    { name: 'Upvotes', value: data.overview.upvotes, color: CHART_COLORS.primary },
    { name: 'Saves', value: data.overview.saves, color: CHART_COLORS.primaryLight },
    { name: 'Comments', value: data.overview.comments, color: CHART_COLORS.primaryDark },
  ];

  return (
    <div className="container mx-auto px-page py-section">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-h1 font-bold text-jet-dark mb-2">
          Stacqer Dashboard
        </h1>
        <p className="text-body text-gray-muted mb-6">
          Comprehensive analytics for your content and engagement on Stacq
        </p>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-6">
          {[7, 30, 90, 365].map((d) => (
            <Button
              key={d}
              variant={days === d ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d === 365 ? '1 Year' : `${d} Days`}
            </Button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          title="Collections"
          value={data.overview.collections}
          icon="📚"
          color={CHART_COLORS.primary}
        />
        <StatCard
          title="Cards"
          value={data.overview.cards}
          icon="🎴"
          color={CHART_COLORS.primaryLight}
        />
        <StatCard
          title="Upvotes"
          value={data.overview.upvotes}
          icon="👍"
          color={CHART_COLORS.primary}
        />
        <StatCard
          title="Saves"
          value={data.overview.saves}
          icon="⭐"
          color={CHART_COLORS.primaryLight}
        />
        <StatCard
          title="Comments"
          value={data.overview.comments}
          icon="💬"
          color={CHART_COLORS.primaryDark}
        />
        <StatCard
          title="Views"
          value={data.overview.views}
          icon="👁️"
          color={CHART_COLORS.accent}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Activity Over Time */}
        <Card className="p-6">
          <h2 className="text-h3 font-semibold text-jet-dark mb-4">
            Activity Over Time
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.timeSeries.collections}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#555555"
                fontSize={12}
              />
              <YAxis stroke="#555555" fontSize={12} />
              <Tooltip
                labelFormatter={(label) => formatDate(label as string)}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E5E5' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                name="Collections"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.primary, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Engagement Distribution */}
        <Card className="p-6">
          <h2 className="text-h3 font-semibold text-jet-dark mb-4">
            Engagement Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={engagementData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {engagementData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Engagement Over Time */}
        <Card className="p-6">
          <h2 className="text-h3 font-semibold text-jet-dark mb-4">
            Engagement Over Time
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.timeSeries.upvotes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#555555"
                fontSize={12}
              />
              <YAxis stroke="#555555" fontSize={12} />
              <Tooltip
                labelFormatter={(label) => formatDate(label as string)}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E5E5' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                name="Upvotes"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.primary, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Content Creation */}
        <Card className="p-6">
          <h2 className="text-h3 font-semibold text-jet-dark mb-4">
            Content Creation
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.timeSeries.cards}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#555555"
                fontSize={12}
              />
              <YAxis stroke="#555555" fontSize={12} />
              <Tooltip
                labelFormatter={(label) => formatDate(label as string)}
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E5E5' }}
              />
              <Legend />
              <Bar
                dataKey="value"
                name="Cards Created"
                fill={CHART_COLORS.primary}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top Performing Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Collections */}
        <Card className="p-6">
          <h2 className="text-h3 font-semibold text-jet-dark mb-4">
            Top Collections
          </h2>
          <div className="space-y-3">
            {data.topCollections.length > 0 ? (
              data.topCollections.map((collection, index) => (
                <div
                  key={collection.id}
                  className="flex items-center justify-between p-3 bg-cloud rounded-lg border border-gray-light"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-emerald font-bold text-lg">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-jet-dark">
                        {collection.title}
                      </p>
                      <p className="text-sm text-gray-muted">
                        {collection.engagement} engagement
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-muted">
                      ↑ {collection.stats?.upvotes || 0} | ⭐{' '}
                      {collection.stats?.saves || 0} | 💬{' '}
                      {collection.stats?.comments || 0}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-muted text-center py-8">
                No collections yet
              </p>
            )}
          </div>
        </Card>

        {/* Top Cards */}
        <Card className="p-6">
          <h2 className="text-h3 font-semibold text-jet-dark mb-4">
            Top Cards
          </h2>
          <div className="space-y-3">
            {data.topCards.length > 0 ? (
              data.topCards.map((card, index) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between p-3 bg-cloud rounded-lg border border-gray-light"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-emerald font-bold text-lg flex-shrink-0">
                      #{index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-jet-dark truncate">
                        {card.title}
                      </p>
                      <p className="text-sm text-gray-muted">
                        {card.engagement} engagement
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm text-gray-muted">
                      ↑ {card.upvotes} | ⭐ {card.saves} | 💬 {card.comments}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-muted text-center py-8">No cards yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* Engagement Metrics */}
      <Card className="p-6">
        <h2 className="text-h3 font-semibold text-jet-dark mb-4">
          Engagement Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-cloud rounded-lg">
            <p className="text-2xl font-bold text-emerald mb-1">
              {data.engagement.totalEngagement}
            </p>
            <p className="text-sm text-gray-muted">Total Engagement</p>
          </div>
          <div className="text-center p-4 bg-cloud rounded-lg">
            <p className="text-2xl font-bold text-emerald mb-1">
              {data.engagement.avgEngagementPerCollection}
            </p>
            <p className="text-sm text-gray-muted">
              Avg Engagement per Collection
            </p>
          </div>
          <div className="text-center p-4 bg-cloud rounded-lg">
            <p className="text-2xl font-bold text-emerald mb-1">
              {data.engagement.collectionsCount}
            </p>
            <p className="text-sm text-gray-muted">Collections in Period</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <Card className="p-6 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-muted mb-1">{title}</p>
          <p className="text-3xl font-bold" style={{ color }}>
            {value.toLocaleString()}
          </p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </Card>
  );
}
