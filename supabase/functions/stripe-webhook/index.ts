import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2023-10-16",
  });

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature) {
    return new Response("Missing signature", { status: 400, headers: corsHeaders });
  }
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return new Response("Server misconfiguration", { status: 500, headers: corsHeaders });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", (err as Error).message);
    return new Response("Webhook signature verification failed", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // --- Idempotency check ---
  const { data: existingEvent } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existingEvent) {
    console.log(`Event ${event.id} already processed, skipping`);
    return new Response(JSON.stringify({ received: true, skipped: true }), { headers: corsHeaders });
  }

  try {
    switch (event.type) {
      // ============================================================
      // 1. checkout.session.completed
      // ============================================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.metadata?.email || session.customer_email;
        const plan = session.metadata?.plan || "essentiel";
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!email) {
          console.error("checkout.session.completed: no email found");
          break;
        }

        // Find profile by email
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, cabinet_id")
          .eq("email", email)
          .maybeSingle();

        if (profileError || !profile) {
          console.error("checkout.session.completed: profile not found for", email, profileError);
          break;
        }

        const cabinetId = profile.cabinet_id;

        // Update cabinet_subscriptions
        await supabase
          .from("cabinet_subscriptions")
          .update({
            status: "active",
            plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_start: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("cabinet_id", cabinetId);

        // Insert payment_history
        await supabase.from("payment_history").insert({
          cabinet_id: cabinetId,
          stripe_payment_intent_id: session.payment_intent as string | null,
          amount_cents: session.amount_total ?? 0,
          currency: session.currency ?? "eur",
          status: "succeeded",
          plan,
          description: `Souscription plan ${plan}`,
        });

        // Record stripe event
        await supabase.from("stripe_events").insert({
          id: event.id,
          type: event.type,
          cabinet_id: cabinetId,
          data: { email, plan, customer_id: customerId, subscription_id: subscriptionId },
        });

        console.log(`checkout.session.completed: cabinet ${cabinetId} activated on plan ${plan}`);
        break;
      }

      // ============================================================
      // 2. invoice.payment_succeeded
      // ============================================================
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Find cabinet via stripe_customer_id
        const { data: sub, error: subError } = await supabase
          .from("cabinet_subscriptions")
          .select("cabinet_id, status, plan")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (subError || !sub) {
          console.error("invoice.payment_succeeded: no cabinet for customer", customerId, subError);
          break;
        }

        const cabinetId = sub.cabinet_id;

        // Reactivate if was past_due or suspended
        if (sub.status === "past_due" || sub.status === "suspended") {
          await supabase.rpc("reactivate_cabinet", {
            p_cabinet_id: cabinetId,
            p_plan: sub.plan,
            p_stripe_sub_id: invoice.subscription as string | null,
          });
          console.log(`invoice.payment_succeeded: reactivated cabinet ${cabinetId}`);
        }

        // Insert payment_history
        await supabase.from("payment_history").insert({
          cabinet_id: cabinetId,
          stripe_invoice_id: invoice.id,
          stripe_payment_intent_id: invoice.payment_intent as string | null,
          amount_cents: invoice.amount_paid ?? 0,
          currency: invoice.currency ?? "eur",
          status: "succeeded",
          plan: sub.plan,
          description: `Paiement facture ${invoice.number || invoice.id}`,
          receipt_url: invoice.hosted_invoice_url ?? null,
        });

        // Record stripe event
        await supabase.from("stripe_events").insert({
          id: event.id,
          type: event.type,
          cabinet_id: cabinetId,
          data: { invoice_id: invoice.id, amount: invoice.amount_paid, customer_id: customerId },
        });

        console.log(`invoice.payment_succeeded: recorded for cabinet ${cabinetId}`);
        break;
      }

      // ============================================================
      // 3. invoice.payment_failed
      // ============================================================
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: sub, error: subError } = await supabase
          .from("cabinet_subscriptions")
          .select("cabinet_id, plan")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (subError || !sub) {
          console.error("invoice.payment_failed: no cabinet for customer", customerId, subError);
          break;
        }

        const cabinetId = sub.cabinet_id;

        // Call handle_payment_failed RPC
        await supabase.rpc("handle_payment_failed", { p_cabinet_id: cabinetId });

        // Record stripe event
        await supabase.from("stripe_events").insert({
          id: event.id,
          type: event.type,
          cabinet_id: cabinetId,
          data: { invoice_id: invoice.id, amount: invoice.amount_due, customer_id: customerId },
        });

        console.log(`invoice.payment_failed: handled for cabinet ${cabinetId}`);
        break;
      }

      // ============================================================
      // 4. customer.subscription.deleted
      // ============================================================
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: sub, error: subError } = await supabase
          .from("cabinet_subscriptions")
          .select("cabinet_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (subError || !sub) {
          console.error("customer.subscription.deleted: no cabinet for customer", customerId, subError);
          break;
        }

        const cabinetId = sub.cabinet_id;

        // Suspend cabinet with reason "canceled"
        await supabase.rpc("suspend_cabinet", {
          p_cabinet_id: cabinetId,
          p_reason: "canceled",
        });

        // Record stripe event
        await supabase.from("stripe_events").insert({
          id: event.id,
          type: event.type,
          cabinet_id: cabinetId,
          data: { subscription_id: subscription.id, customer_id: customerId },
        });

        console.log(`customer.subscription.deleted: suspended cabinet ${cabinetId}`);
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
        await supabase.from("stripe_events").insert({
          id: event.id,
          type: event.type,
          data: { raw_type: event.type },
        });
    }
  } catch (err) {
    console.error(`Error processing ${event.type}:`, (err as Error).message);
    return new Response(JSON.stringify({ received: true, error: (err as Error).message }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
});
