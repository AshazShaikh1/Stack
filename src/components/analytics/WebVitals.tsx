'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { analytics } from '@/lib/analytics';

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Only track core metrics to reduce noise/quota
    if (['FCP', 'LCP', 'CLS', 'FID', 'TTFB', 'INP'].includes(metric.name)) {
      analytics.track({
        name: 'Web Vitals',
        properties: {
          metric_name: metric.name,
          value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value), // Normalize CLS
          id: metric.id, // Unique ID for this metric instance
          rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
          path: window.location.pathname,
        }
      });
    }
  });

  return null;
}