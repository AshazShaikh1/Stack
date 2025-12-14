"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PaywallModal } from "./PaywallModal";

interface StackerDashboardProps {
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    role: string;
    // Assuming we might have a subscription status in the future
    is_pro?: boolean;
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
  engagement: {
    totalEngagement: number;
    avgEngagementPerCollection: number;
    collectionsCount: number;
  };
}

const CHART_COLORS = {
  emerald: "#1DB954",
  emeraldDark: "#116E32",
  emeraldLight: "#7CE0A3", // Lighter emerald for gradients/fills
  jet: "#312F2C",
  gray: "#E5E5E5",
  purple: "#8B5CF6", // For premium/special accents
};

export function StackerDashboard({ user }: StackerDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  // Paywall State
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState("");

  // Check if user is actually pro (mocked for now, assumes false unless specified)
  const isPro = (user as any).is_pro === true;

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/stacker/analytics?days=${days}`);

      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [days]); // Depends on 'days'

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handlePremiumClick = (feature: string) => {
    if (!isPro) {
      setPaywallFeature(feature);
      setIsPaywallOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-8 space-y-8">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) return null; // Handle error UI separately if needed

  // Helper for date formatting
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-8 pb-20">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-jet-dark mb-2">
            Dashboard
          </h1>
          <p className="text-gray-muted text-lg">
            Welcome back,{" "}
            <span className="font-semibold text-emerald">
              {user.display_name}
            </span>
          </p>
        </div>

        <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-light shadow-sm">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => {
                if (d > 30 && !isPro) {
                  handlePremiumClick("Extended History");
                } else {
                  setDays(d);
                }
              }}
              className={`
                px-4 py-1.5 rounded-md text-sm font-medium transition-all
                ${
                  days === d
                    ? "bg-jet-dark text-white shadow-sm"
                    : "text-gray-500 hover:text-jet-dark hover:bg-gray-50"
                }
                ${
                  d > 30 && !isPro
                    ? "opacity-50 cursor-not-allowed relative group"
                    : ""
                }
              `}
            >
              {d > 30 && !isPro && (
                <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>
              )}
              {d} Days
            </button>
          ))}
        </div>
      </div>

      {/* 2. Key Metrics Row (Bento Top) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Views"
          value={data.overview.views}
          trend="+12%"
          icon="👁️"
          color="emerald"
        />
        <MetricCard
          title="Upvotes"
          value={data.overview.upvotes}
          trend="+5%"
          icon="👍"
          color="jet"
        />
        <MetricCard
          title="Collections Created"
          value={data.overview.collections}
          icon="📚"
          color="purple"
        />
        {/* Premium Metric Teaser */}
        <div
          onClick={() => handlePremiumClick("Growth Velocity")}
          className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-black text-white p-6 rounded-2xl cursor-pointer group shadow-lg transition-transform hover:-translate-y-1"
        >
          <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-xs font-semibold">
            PRO
          </div>
          <p className="text-gray-400 text-sm mb-1">Growth Velocity</p>
          <div className="filter blur-sm select-none opacity-50">
            <p className="text-3xl font-bold">88.5%</p>
            <p className="text-emerald-400 text-sm">▲ Trending up</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
            <span className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full text-sm font-bold shadow-xl transform scale-95 group-hover:scale-100 transition-transform">
              Unlock 🔒
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Chart Section (Bento Middle) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Main Engagement Chart (Free) */}
        <Card className="lg:col-span-2 p-6 rounded-2xl shadow-sm border border-gray-light">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-jet-dark">
              Engagement Overview
            </h3>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald"></span>{" "}
                Upvotes
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-300"></span> Views
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeSeries.upvotes}>
                <defs>
                  <linearGradient id="colorUpvotes" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS.emerald}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS.emerald}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#888", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#888", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_COLORS.emerald}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorUpvotes)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Conversion Funnel (Premium) */}
        <Card
          onClick={() => handlePremiumClick("Conversion Analysis")}
          className="relative p-6 rounded-2xl shadow-sm border border-gray-light overflow-hidden cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-jet-dark">
              Conversion Funnel
            </h3>
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">
              PRO
            </span>
          </div>

          {/* Blurred Content */}
          <div className="filter blur-md opacity-40 pointer-events-none select-none">
            <div className="space-y-6 mt-8">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Impressions</span>
                  <span className="font-bold">12,450</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full w-full overflow-hidden">
                  <div className="h-full bg-jet w-full rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Clicks</span>
                  <span className="font-bold">3,205</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full w-full overflow-hidden">
                  <div className="h-full bg-emerald w-[45%] rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Saves</span>
                  <span className="font-bold">850</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full w-full overflow-hidden">
                  <div className="h-full bg-emerald-light w-[15%] rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/10 group-hover:bg-white/5 transition-colors">
            <div className="bg-white p-4 rounded-xl shadow-xl text-center border border-gray-100">
              <div className="text-2xl mb-2">📊</div>
              <p className="font-bold text-jet-dark text-sm mb-3">
                See who converts
              </p>
              <Button size="sm" variant="primary" className="w-full">
                Unlock
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. Bottom Section (Bento Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Collections List */}
        <Card className="p-6 rounded-2xl border border-gray-light">
          <h3 className="font-bold text-lg text-jet-dark mb-4">
            Top Performing Collections
          </h3>
          <div className="space-y-4">
            {data.topCollections.slice(0, 5).map((col, i) => (
              <div
                key={col.id}
                className="flex items-center gap-4 group cursor-default"
              >
                <div className="font-mono text-gray-300 font-bold text-xl w-6">
                  0{i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-jet-dark group-hover:text-emerald transition-colors">
                    {col.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date().toLocaleDateString()} • {col.stats.views || 0}{" "}
                    views
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-emerald font-bold">{col.engagement}</div>
                  <div className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">
                    Engagements
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Content Type Breakdown (Pie) */}
        <Card className="p-6 rounded-2xl border border-gray-light flex flex-col">
          <h3 className="font-bold text-lg text-jet-dark mb-4">
            Content Distribution
          </h3>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Cards", value: data.overview.cards },
                    { name: "Collections", value: data.overview.collections },
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill={CHART_COLORS.emerald} />
                  <Cell fill={CHART_COLORS.jet} />
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 p-4 bg-gray-50 rounded-xl text-center">
            <p className="text-sm text-gray-600 mb-2">
              Get personalized content recommendations to boost your reach.
            </p>
            <button
              onClick={() => handlePremiumClick("AI Recommendations")}
              className="text-emerald font-bold text-sm hover:underline"
            >
              Unlock AI Insights →
            </button>
          </div>
        </Card>
      </div>

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        featureName={paywallFeature}
      />
    </div>
  );
}

// Sub-component for Bento Cards
function MetricCard({ title, value, trend, icon, color }: any) {
  const isEmerald = color === "emerald";

  return (
    <Card className="p-5 rounded-2xl border border-gray-light shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div
          className={`p-2 rounded-lg ${
            isEmerald ? "bg-emerald/10 text-emerald" : "bg-gray-100 text-jet"
          }`}
        >
          {icon}
        </div>
        {trend && (
          <span className="text-xs font-bold text-emerald bg-emerald/5 px-2 py-1 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-jet-dark">
          {value?.toLocaleString()}
        </p>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
      </div>
    </Card>
  );
}
