const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { raison_sociale, ville, adresse } = await req.json();
    if (!raison_sociale) {
      return new Response(JSON.stringify({ error: "raison_sociale requis", found: false, status: "error" }), {
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

    const data = await res.json();
    const candidates = data.candidates ?? [];

    if (candidates.length === 0) {
      return new Response(JSON.stringify({
        found: false,
        place: null,
        alertes: ["Aucune presence physique detectee — risque societe ecran"],
        status: "ATTENTION",
        mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`,
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
      mapsEmbedUrl: lat && lng
        ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=15`
        : null,
      status: alertes.length > 0 ? "ATTENTION" : "ok",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      found: false,
      alertes: [],
      status: "unavailable",
      error: (error as Error).message,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
