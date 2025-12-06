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
        // Suppress Mixpanel console errors when blocked by ad blockers
        this.suppressMixpanelErrors();
        
        // Dynamic import to avoid loading Mixpanel in SSR
        const mixpanelModule = await import('mixpanel-browser');
        const mixpanel = mixpanelModule.default || mixpanelModule;
        if (mixpanel && typeof mixpanel.init === 'function') {
          mixpanel.init(this.mixpanelToken, {
            debug: false, // Disable debug to reduce console noise
            track_pageview: false, // We'll track pageviews manually
            persistence: 'localStorage',
            ignore_dnt: true, // Respect user privacy but don't fail
          });
          this.isInitialized = true;
        }
      } catch (error) {
        // Silently fail - analytics is optional and often blocked by ad blockers
        // Don't log errors to avoid console noise
      }
    }
  }

  /**
   * Suppress Mixpanel console errors when blocked by ad blockers
   */
  private suppressMixpanelErrors() {
    if (typeof window === 'undefined') return;

    // Only set up error suppression once
    if ((window as any).__mixpanelErrorSuppressed) return;
    (window as any).__mixpanelErrorSuppressed = true;

    // Override console.error to filter out Mixpanel errors
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const message = String(args[0] || '');
      const fullMessage = args.map(String).join(' ');
      
      // Filter out Mixpanel-related errors
      if (
        message.includes('Mixpanel error') ||
        message.includes('Bad HTTP status: 0') ||
        fullMessage.includes('api-js.mixpanel.com') ||
        fullMessage.includes('ERR_BLOCKED_BY_CLIENT') ||
        fullMessage.includes('mixpanel.com/track') ||
        fullMessage.includes('mixpanel.com/engage')
      ) {
        // Silently ignore - these are expected when ad blockers are active
        return;
      }
      // Call original console.error for other errors
      originalError.apply(console, args);
    };

    // Also suppress network errors in console
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const message = String(args[0] || '');
      const fullMessage = args.map(String).join(' ');
      
      // Filter out Mixpanel warnings
      if (
        fullMessage.includes('Mixpanel') ||
        fullMessage.includes('mixpanel.com')
      ) {
        return;
      }
      originalWarn.apply(console, args);
    };
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
          // Wrap in try-catch to handle network errors silently
          try {
            mixpanel.track(event.name, {
              ...event.properties,
              timestamp: new Date().toISOString(),
            });

            // Identify user if userId is provided
            if (event.userId && typeof mixpanel.identify === 'function') {
              mixpanel.identify(event.userId);
            }
          } catch (trackError: any) {
            // Silently ignore network errors (often caused by ad blockers)
            // Only log in development if it's not a network/blocking error
            if (
              process.env.NODE_ENV === 'development' &&
              trackError?.message &&
              !trackError.message.includes('network') &&
              !trackError.message.includes('blocked')
            ) {
              console.warn('Failed to track event:', trackError);
            }
          }
        }
      }
    } catch (error) {
      // Silently fail - analytics is optional and often blocked
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
          try {
            mixpanel.identify(userId);
            if (traits && mixpanel.people && typeof mixpanel.people.set === 'function') {
              mixpanel.people.set(traits);
            }
          } catch (identifyError) {
            // Silently ignore - often blocked by ad blockers
          }
        }
      }
    } catch (error) {
      // Silently fail - analytics is optional
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
          try {
            mixpanel.people.set(properties);
          } catch (setError) {
            // Silently ignore - often blocked by ad blockers
          }
        }
      }
    } catch (error) {
      // Silently fail - analytics is optional
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
   * Track collection creation
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
   * Track collection view
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
  search: (userId: string | null, query: string, type: 'all' | 'collections' | 'cards' | 'users', resultCount: number) => {
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
   * Track become stacqer
   */
  becomeStacker: (userId: string) => {
    analytics.track({
      name: 'become_stacker',
      properties: {},
      userId,
    });
  },

  /**
   * Track collection view
   */
  viewCollection: (userId: string | null, collectionId: string) => {
    analytics.track({
      name: 'view_collection',
      properties: {
        collection_id: collectionId,
        is_authenticated: !!userId,
      },
      userId: userId || undefined,
    });
  },

  /**
   * Track save
   */
  save: (userId: string, targetId: string) => {
    analytics.track({
      name: 'save',
      properties: {
        target_type: 'collection',
        target_id: targetId,
      },
      userId,
    });
  },

  /**
   * Track unsave
   */
  unsave: (userId: string, targetId: string) => {
    analytics.track({
      name: 'unsave',
      properties: {
        target_type: 'collection',
        target_id: targetId,
      },
      userId,
    });
  },
};

