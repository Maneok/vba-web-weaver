import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Non autorise" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { raison_sociale, ville, adresse } = await req.json();
    if (!raison_sociale || typeof raison_sociale !== "string" || raison_sociale.length > 200) {
      return new Response(JSON.stringify({ error: "raison_sociale requis (max 200 caracteres)", found: false, status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ville && (typeof ville !== "string" || ville.length > 100)) {
      return new Response(JSON.stringify({ error: "ville invalide (max 100 caracteres)", found: false, status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (adresse && (typeof adresse !== "string" || adresse.length > 300)) {
      return new Response(JSON.stringify({ error: "adresse invalide (max 300 caracteres)", found: false, status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({
        found: false,
        alertes: [],
        status: "unavailable",
        error: "Cle API Google non configuree",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchQuery = `${raison_sociale} ${ville || ""}`.trim();
    const fields = "name,formatted_address,business_status,rating,user_ratings_total,opening_hours,website,geometry";

    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=${fields}&key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return new Response(JSON.stringify({
        found: false,
        alertes: [],
        status: "unavailable",
        error: `Google Places API: ${res.status}`,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data: any;
    try { data = await res.json(); } catch {
      return new Response(JSON.stringify({
        found: false, alertes: [], status: "unavailable", error: "Google Places API: reponse non-JSON",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const candidates = data.candidates ?? [];

    if (candidates.length === 0) {
      return new Response(JSON.stringify({
        found: false,
        place: null,
        alertes: ["Non referencee sur Google Maps — verification manuelle recommandee"],
        status: "ATTENTION",
        mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`,
        mapsEmbedUrl: null,
        streetViewUrl: null,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const place = candidates[0];
    const alertes: string[] = [];

    if (place.business_status === "CLOSED_PERMANENTLY") {
      alertes.push("Etablissement ferme definitivement");
    } else if (place.business_status === "CLOSED_TEMPORARILY") {
      alertes.push("Etablissement temporairement ferme");
    }

    if ((place.user_ratings_total ?? 0) === 0 && !place.website) {
      alertes.push("Aucun avis et pas de site web — faible visibilite");
    }

    const lat = place.geometry?.location?.lat;
    const lng = place.geometry?.location?.lng;

    return new Response(JSON.stringify({
      found: true,
      place: {
        name: place.name ?? "",
        address: place.formatted_address ?? "",
        businessStatus: place.business_status ?? "OPERATIONAL",
        rating: place.rating ?? null,
        totalRatings: place.user_ratings_total ?? 0,
        isOpen: place.opening_hours?.open_now ?? null,
        website: place.website ?? null,
        lat,
        lng,
      },
      alertes,
      mapsUrl: lat && lng
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`,
      mapsEmbedUrl: null,
      streetViewUrl: lat && lng
        ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`
        : null,
      status: alertes.length > 0 ? "ATTENTION" : "ok",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[google-places-verify] Error:", (error as Error).message);
    return new Response(JSON.stringify({
      found: false,
      alertes: [],
      status: "unavailable",
      error: "Erreur interne du service Google Places",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
