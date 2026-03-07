import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

interface PersonToCheck {
  nom: string;
  prenom?: string;
  dateNaissance?: string;
  nationalite?: string;
}

interface SanctionMatch {
  person: string;
  score: number;
  datasets: string[];
  caption: string;
  schema: string;
  isPPE: boolean;
  details: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { persons, siren } = await req.json() as { persons: PersonToCheck[]; siren?: string };

    if (!persons || persons.length === 0) {
      return new Response(JSON.stringify({ matches: [], checked: 0 }), { headers: CORS });
    }

    const allMatches: SanctionMatch[] = [];
    let checked = 0;

    for (const person of persons.slice(0, 10)) {
      const fullName = `${person.prenom ?? ""} ${person.nom}`.trim();
      if (!fullName || fullName.length < 2) continue;

      checked++;

      // Build request body for OpenSanctions match API
      const body: Record<string, unknown> = {
        schema: "Person",
        properties: {
          name: [fullName],
        },
      };

      if (person.dateNaissance) {
        body.properties = { ...(body.properties as Record<string, unknown>), birthDate: [person.dateNaissance] };
      }
      if (person.nationalite) {
        body.properties = { ...(body.properties as Record<string, unknown>), nationality: [person.nationalite] };
      }

      try {
        const res = await fetch("https://api.opensanctions.org/match/default", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          console.error(`OpenSanctions returned ${res.status} for ${fullName}`);
          continue;
        }

        const data = await res.json();
        const responses = data.responses?.default ?? data.results ?? [];

        for (const result of responses) {
          const matchScore = result.score ?? 0;
          if (matchScore < 0.5) continue;

          const datasets = result.datasets ?? [];
          const schema = result.schema ?? "";
          const caption = result.caption ?? result.name ?? "";

          // Determine if PPE
          const isPPE = datasets.some((d: string) =>
            d.toLowerCase().includes("pep") ||
            d.toLowerCase().includes("ppe") ||
            d.toLowerCase().includes("politically")
          ) || schema.toLowerCase().includes("pep");

          // Determine sanction type
          const sanctionTypes: string[] = [];
          if (datasets.some((d: string) => d.includes("ofac") || d.includes("us_"))) sanctionTypes.push("OFAC (USA)");
          if (datasets.some((d: string) => d.includes("eu_") || d.includes("europe"))) sanctionTypes.push("UE");
          if (datasets.some((d: string) => d.includes("un_") || d.includes("united_nations"))) sanctionTypes.push("ONU");
          if (datasets.some((d: string) => d.includes("uk_") || d.includes("gbr"))) sanctionTypes.push("UK");
          if (datasets.some((d: string) => d.includes("fr_") || d.includes("france"))) sanctionTypes.push("France");
          if (isPPE) sanctionTypes.push("PPE");

          allMatches.push({
            person: fullName,
            score: matchScore,
            datasets,
            caption,
            schema,
            isPPE,
            details: `${caption} — Sources: ${sanctionTypes.join(", ") || datasets.slice(0, 3).join(", ")} — Score: ${(matchScore * 100).toFixed(0)}%`,
          });
        }
      } catch (e) {
        console.error(`Error checking ${fullName}:`, e);
      }
    }

    // Also check company name against sanctions if siren provided
    if (siren) {
      try {
        const companyBody = {
          schema: "Company",
          properties: { registrationNumber: [siren.replace(/\s/g, "")] },
        };
        const res = await fetch("https://api.opensanctions.org/match/default", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(companyBody),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          const responses = data.responses?.default ?? data.results ?? [];
          for (const result of responses) {
            if ((result.score ?? 0) >= 0.5) {
              allMatches.push({
                person: `SIREN ${siren}`,
                score: result.score,
                datasets: result.datasets ?? [],
                caption: result.caption ?? "",
                schema: result.schema ?? "",
                isPPE: false,
                details: `Entite ${result.caption} — Score: ${((result.score ?? 0) * 100).toFixed(0)}%`,
              });
            }
          }
        }
      } catch {
        // Non-blocking
      }
    }

    const hasCriticalMatch = allMatches.some(m => m.score >= 0.7);
    const hasPPE = allMatches.some(m => m.isPPE);

    return new Response(JSON.stringify({
      matches: allMatches,
      checked,
      hasCriticalMatch,
      hasPPE,
      status: allMatches.length > 0 ? (hasCriticalMatch ? "ALERTE" : "ATTENTION") : "OK",
    }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), matches: [], checked: 0, status: "ERREUR" }), { status: 500, headers: CORS });
  }
});
