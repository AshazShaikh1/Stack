import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/api-service";
import Stripe from "stripe";

/**
 * POST /api/payments/webhook
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("Webhook Error: STRIPE_WEBHOOK_SECRET is missing");
      return NextResponse.json(
        { error: "Server Configuration Error" },
        { status: 500 }
      );
    }

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Handle the event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session, supabase);
    } else if (event.type === "payment_intent.succeeded") {
      // Payment succeeded (already handled by checkout.session.completed)
      console.log("PaymentIntent succeeded:", event.data.object);
    } else if (event.type === "payment_intent.payment_failed") {
      // Payment failed
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentFailed(paymentIntent, supabase);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: error.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof createServiceClient>
) {
  const metadata = session.metadata;
  if (!metadata) {
    console.error("No metadata in checkout session");
    return;
  }

  const {
    user_id,
    type,
    duration,
    collection_id,
    stack_id,
    username,
    duration_days,
  } = metadata;

  const id = collection_id || stack_id; // Support both

  if (!user_id || !type) {
    console.error("Missing required metadata:", { user_id, type });
    return;
  }

  // Record payment in database
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      stripe_payment_id: session.payment_intent as string,
      user_id,
      amount: session.amount_total || 0,
      currency: session.currency || "usd",
      type,
      status: "completed",
      metadata: {
        duration,
        collection_id: collection_id || null,
        stack_id: stack_id || null, // Legacy support
        username: username || null,
        duration_days: duration_days || null,
        session_id: session.id,
      },
    })
    .select()
    .single();

  if (paymentError) {
    console.error("Error recording payment:", paymentError);
    return;
  }

  // Apply the payment benefit based on type
  const days = duration_days ? parseInt(duration_days, 10) : null;
  const expiresAt = days
    ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  switch (type) {
    case "promote":
      if (id && expiresAt) {
        // Try collections first
        const { error: collectionError } = await supabase
          .from("collections")
          .update({ promoted_until: expiresAt })
          .eq("id", id);

        // Fallback to stacks for legacy support
        if (collectionError) {
          await supabase
            .from("stacks")
            .update({ promoted_until: expiresAt })
            .eq("id", id);
        }
      }
      break;

    case "hidden_stack":
      if (id && expiresAt) {
        // Try collections first
        const { error: collectionError } = await supabase
          .from("collections")
          .update({ is_hidden: true })
          .eq("id", id);

        // Fallback to stacks for legacy support
        if (collectionError) {
          await supabase
            .from("stacks")
            .update({ is_hidden: true })
            .eq("id", id);
        }
        // Note: We don't automatically unhide after expiry - that would require a worker
        // For MVP, hidden collections stay hidden until manually changed
      }
      break;

    case "featured_stacker":
      if (expiresAt) {
        await supabase
          .from("users")
          .update({ featured_until: expiresAt })
          .eq("id", user_id);
      }
      break;

    case "reserve_username":
      if (username) {
        // Update user's username and mark as reserved
        await supabase
          .from("users")
          .update({
            username: username.toLowerCase(),
            reserved_username: true,
          })
          .eq("id", user_id);
      }
      break;

    default:
      console.error("Unknown payment type:", type);
  }

  console.log("Payment processed successfully:", {
    payment_id: payment.id,
    type,
  });
}

async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  supabase: ReturnType<typeof createServiceClient>
) {
  // Record failed payment
  await supabase.from("payments").insert({
    stripe_payment_id: paymentIntent.id,
    user_id: paymentIntent.metadata?.user_id || null,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    type: paymentIntent.metadata?.type || "unknown",
    status: "failed",
    metadata: paymentIntent.metadata || {},
  });

  console.log("Payment failed recorded:", paymentIntent.id);
}