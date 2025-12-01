/**
 * Analytics utility for tracking user events
 * Supports Mixpanel and can be extended for other analytics providers
 */

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  userId?: string;
}

class Analytics {
  private mixpanelToken: string | null = null;
  private isEnabled: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.mixpanelToken = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || null;
      this.isEnabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true';
      this.initialize();
    }
  }

  private async initialize() {
    if (!this.isEnabled || this.isInitialized) return;

    // Initialize Mixpanel if token is provided
    if (this.mixpanelToken && typeof window !== 'undefined') {
      try {
        // Dynamic import to avoid loading Mixpanel in SSR
        const mixpanelModule = await import('mixpanel-browser');
        const mixpanel = mixpanelModule.default || mixpanelModule;
        if (mixpanel && typeof mixpanel.init === 'function') {
          mixpanel.init(this.mixpanelToken, {
            debug: process.env.NODE_ENV === 'development',
            track_pageview: false, // We'll track pageviews manually
            persistence: 'localStorage',
          });
          this.isInitialized = true;
        }
      } catch (error) {
        console.warn('Failed to initialize Mixpanel:', error);
        // Continue without Mixpanel - analytics will just log to console
      }
    }
  }

  /**
   * Track an event
   */
  async track(event: AnalyticsEvent) {
    if (!this.isEnabled) {
      // In development, log events to console
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics]', event.name, event.properties);
      }
      return;
    }

    try {
      if (this.isInitialized && typeof window !== 'undefined') {
        const mixpanelModule = await import('mixpanel-browser');
        const mixpanel = mixpanelModule.default || mixpanelModule;
        if (mixpanel && typeof mixpanel.track === 'function') {
          mixpanel.track(event.name, {
            ...event.properties,
            timestamp: new Date().toISOString(),
          });

          // Identify user if userId is provided
          if (event.userId && typeof mixpanel.identify === 'function') {
            mixpanel.identify(event.userId);
          }
        }
      }
    } catch (error) {
      // Silently fail - analytics is optional
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to track event:', error);
      }
    }
  }

  /**
   * Identify a user
   */
  async identify(userId: string, traits?: Record<string, any>) {
    if (!this.isEnabled) return;

    try {
      if (this.isInitialized && typeof window !== 'undefined') {
        const mixpanelModule = await import('mixpanel-browser');
        const mixpanel = mixpanelModule.default || mixpanelModule;
        if (mixpanel && typeof mixpanel.identify === 'function') {
          mixpanel.identify(userId);
          if (traits && mixpanel.people && typeof mixpanel.people.set === 'function') {
            mixpanel.people.set(traits);
          }
        }
      }
    } catch (error) {
      // Silently fail - analytics is optional
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to identify user:', error);
      }
    }
  }

  /**
   * Track page view
   */
  async pageView(path: string, properties?: Record<string, any>) {
    await this.track({
      name: 'Page View',
      properties: {
        path,
        ...properties,
      },
    });
  }

  /**
   * Set user properties
   */
  async setUserProperties(properties: Record<string, any>) {
    if (!this.isEnabled) return;

    try {
      if (this.isInitialized && typeof window !== 'undefined') {
        const mixpanelModule = await import('mixpanel-browser');
        const mixpanel = mixpanelModule.default || mixpanelModule;
        if (mixpanel && mixpanel.people && typeof mixpanel.people.set === 'function') {
          mixpanel.people.set(properties);
        }
      }
    } catch (error) {
      // Silently fail - analytics is optional
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to set user properties:', error);
      }
    }
  }
}

// Create singleton instance
export const analytics = new Analytics();

/**
 * Event tracking functions for common actions
 */
export const trackEvent = {
  /**
   * Track user signup
   */
  signup: (userId: string, method: 'email' | 'oauth') => {
    analytics.track({
      name: 'signup',
      properties: {
        method,
      },
      userId,
    });
  },

  /**
   * Track user login
   */
  login: (userId: string, method: 'email' | 'oauth') => {
    analytics.track({
      name: 'login',
      properties: {
        method,
      },
      userId,
    });
  },

  /**
   * Track stack creation
   */
  createStack: (userId: string, stackId: string, isPublic: boolean) => {
    analytics.track({
      name: 'create_stack',
      properties: {
        stack_id: stackId,
        is_public: isPublic,
      },
      userId,
    });
  },

  /**
   * Track card addition
   */
  addCard: (userId: string, cardId: string, stackId: string, cardType: 'link' | 'image' | 'document') => {
    analytics.track({
      name: 'add_card',
      properties: {
        card_id: cardId,
        stack_id: stackId,
        card_type: cardType,
      },
      userId,
    });
  },

  /**
   * Track extension save
   */
  extensionSave: (userId: string, cardId: string, stackId: string, cardType: 'link' | 'image' | 'document') => {
    analytics.track({
      name: 'extension_save',
      properties: {
        card_id: cardId,
        stack_id: stackId,
        card_type: cardType,
      },
      userId,
    });
  },

  /**
   * Track stack clone
   */
  cloneStack: (userId: string, originalStackId: string, clonedStackId: string) => {
    analytics.track({
      name: 'clone_stack',
      properties: {
        original_stack_id: originalStackId,
        cloned_stack_id: clonedStackId,
      },
      userId,
    });
  },

  /**
   * Track upvote
   */
  upvote: (userId: string, targetType: 'stack' | 'card' | 'comment', targetId: string) => {
    analytics.track({
      name: 'upvote',
      properties: {
        target_type: targetType,
        target_id: targetId,
      },
      userId,
    });
  },

  /**
   * Track comment
   */
  comment: (userId: string, targetType: 'stack' | 'card', targetId: string, commentId: string) => {
    analytics.track({
      name: 'comment',
      properties: {
        target_type: targetType,
        target_id: targetId,
        comment_id: commentId,
      },
      userId,
    });
  },

  /**
   * Track follow
   */
  follow: (userId: string, followingId: string) => {
    analytics.track({
      name: 'follow',
      properties: {
        following_id: followingId,
      },
      userId,
    });
  },

  /**
   * Track stack view
   */
  viewStack: (userId: string | null, stackId: string) => {
    analytics.track({
      name: 'view_stack',
      properties: {
        stack_id: stackId,
        is_authenticated: !!userId,
      },
      userId: userId || undefined,
    });
  },

  /**
   * Track profile view
   */
  viewProfile: (userId: string | null, profileUserId: string) => {
    analytics.track({
      name: 'view_profile',
      properties: {
        profile_user_id: profileUserId,
        is_own_profile: userId === profileUserId,
        is_authenticated: !!userId,
      },
      userId: userId || undefined,
    });
  },

  /**
   * Track search
   */
  search: (userId: string | null, query: string, type: 'all' | 'stacks' | 'cards' | 'users', resultCount: number) => {
    analytics.track({
      name: 'search',
      properties: {
        query,
        search_type: type,
        result_count: resultCount,
      },
      userId: userId || undefined,
    });
  },

  /**
   * Track become stacker
   */
  becomeStacker: (userId: string) => {
    analytics.track({
      name: 'become_stacker',
      properties: {},
      userId,
    });
  },
};

