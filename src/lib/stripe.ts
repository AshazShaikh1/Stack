import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
});

// Payment types
export type PaymentType = 'promote' | 'reserve_username' | 'hidden_stack' | 'featured_stacker';

// Pricing configuration (in cents)
export const PRICING = {
  promote: {
    // Promote a stack for 7 days
    '7days': 999, // $9.99
    '30days': 2999, // $29.99
    '90days': 7999, // $79.99
  },
  reserve_username: 4999, // $49.99 one-time
  hidden_stack: {
    // Make a stack hidden (paid feature)
    '30days': 1999, // $19.99
    '90days': 4999, // $49.99
    '365days': 14999, // $149.99
  },
  featured_stacker: {
    // Feature a stacker profile
    '7days': 1999, // $19.99
    '30days': 5999, // $59.99
    '90days': 14999, // $149.99
  },
} as const;

export function getPrice(type: PaymentType, duration?: string): number {
  switch (type) {
    case 'promote':
      if (!duration) throw new Error('Duration required for promote');
      return PRICING.promote[duration as keyof typeof PRICING.promote] || PRICING.promote['7days'];
    case 'reserve_username':
      return PRICING.reserve_username;
    case 'hidden_stack':
      if (!duration) throw new Error('Duration required for hidden_stack');
      return PRICING.hidden_stack[duration as keyof typeof PRICING.hidden_stack] || PRICING.hidden_stack['30days'];
    case 'featured_stacker':
      if (!duration) throw new Error('Duration required for featured_stacker');
      return PRICING.featured_stacker[duration as keyof typeof PRICING.featured_stacker] || PRICING.featured_stacker['7days'];
    default:
      throw new Error(`Unknown payment type: ${type}`);
  }
}

export function getDurationDays(duration: string): number {
  const match = duration.match(/(\d+)days/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);
  return parseInt(match[1], 10);
}

