import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const PLANS: Record<string, { priceId: string; name: string }> = {
  essentiel: {
    priceId: Deno.env.get("STRIPE_PRICE_ESSENTIEL") ?? "",
    name: "Essentiel",
  },
  pro: {
    priceId: Deno.env.get("STRIPE_PRICE_PRO") ?? "",
    name: "Pro",
  },
  cabinet: {
    priceId: Deno.env.get("STRIPE_PRICE_CABINET") ?? "",
    name: "Cabinet",
  },
};

serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2023-10-16",
    });

    const { plan, email, returnUrl } = await req.json();

    // Validate returnUrl against allowed origins to prevent open redirect
    const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:5173";
    let safeOrigin = siteUrl;
    if (returnUrl) {
      try {
        const parsed = new URL(returnUrl);
        const allowed = (Deno.env.get("ALLOWED_ORIGINS") || siteUrl).split(",");
        if (allowed.includes(parsed.origin)) {
          safeOrigin = parsed.origin;
        }
      } catch {
        // Invalid URL, use default
      }
    }

    if (!plan || !PLANS[plan]) {
      return new Response(
        JSON.stringify({ error: "Plan invalide. Choisissez: essentiel, pro, cabinet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Adresse email invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const selectedPlan = PLANS[plan];

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: selectedPlan.priceId,
          quantity: 1,
        },
      ],
      metadata: {
        plan,
        email,
      },
      success_url: `${safeOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${safeOrigin}/pricing?canceled=true`,
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Stripe checkout error");
    return new Response(
      JSON.stringify({ error: "Erreur lors de la creation de la session de paiement" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
