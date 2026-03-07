import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { raison_sociale, ville, adresse } = await req.json();
    if (!raison_sociale) {
      return new Response(JSON.stringify({ error: "raison_sociale requis" }), { status: 400, headers: CORS });
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({
        found: false,
        alertes: [],
        status: "INDISPONIBLE",
        error: "Cle API Google Maps non configuree",
      }), { headers: CORS });
    }

    const searchQuery = `${raison_sociale} ${ville || ""}`.trim();
    const fields = "name,formatted_address,business_status,rating,user_ratings_total,opening_hours,website,geometry";

    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=${fields}&key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return new Response(JSON.stringify({
        found: false,
        alertes: ["API Google Places indisponible"],
        status: "ERREUR",
      }), { headers: CORS });
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
      }), { headers: CORS });
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
      status: alertes.length > 0 ? "ATTENTION" : "OK",
    }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({
      found: false,
      alertes: [],
      status: "ERREUR",
      error: String(err),
    }), { status: 500, headers: CORS });
  }
});
