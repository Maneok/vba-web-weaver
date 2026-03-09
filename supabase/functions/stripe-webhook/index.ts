import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2023-10-16",
  });

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing signature" }), { status: 400, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" } });
  }
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), { status: 500, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" } });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", (err as Error).message);
    return new Response("Webhook signature verification failed", { status: 400, headers: { "X-Content-Type-Options": "nosniff" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.metadata?.email || session.customer_email;
      const plan = session.metadata?.plan || "essentiel";
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!email) {
        console.error("No email found in session");
        break;
      }

      // Create user in Supabase Auth (with a temporary password they'll reset)
      const tempPassword = crypto.randomUUID();
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { plan, stripe_customer_id: customerId },
      });

      if (authError) {
        // User might already exist
        if (authError.message?.includes("already been registered")) {
          // Use targeted lookup instead of listing all users
          const { data: users } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
          if (users) {
            const existingUser = { id: users.id };
            await supabase.from("subscriptions").upsert({
              user_id: existingUser.id,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan,
              status: "active",
              current_period_start: new Date().toISOString(),
            }, { onConflict: "stripe_subscription_id" });
          }
        } else {
          console.error("Auth error:", authError);
        }
        break;
      }

      if (authData.user) {
        await supabase.from("subscriptions").insert({
          user_id: authData.user.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          status: "active",
          current_period_start: new Date().toISOString(),
        });

        // Send password reset email so user can set their password
        await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const updateData: Record<string, string> = {
        status: subscription.status === "active" ? "active" : subscription.status === "past_due" ? "past_due" : "canceled",
        updated_at: new Date().toISOString(),
      };
      if (subscription.current_period_start) {
        updateData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
      }
      if (subscription.current_period_end) {
        updateData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
      }
      await supabase
        .from("subscriptions")
        .update(updateData)
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from("subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
});
