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
    const body = await req.json();
    const persons = Array.isArray(body?.persons) ? body.persons : [];
    const siren = typeof body?.siren === "string" ? body.siren : undefined;

    if (persons.length === 0) {
      return new Response(JSON.stringify({ matches: [], checked: 0, status: "ok" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENSANCTIONS_API_KEY");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["Authorization"] = `ApiKey ${apiKey}`;
    }

    const allMatches: any[] = [];
    let checked = 0;

    for (const person of persons.slice(0, 10)) {
      if (typeof person?.nom !== "string") continue;
      const prenom = typeof person.prenom === "string" ? person.prenom.slice(0, 100) : "";
      const nom = person.nom.slice(0, 100);
      const fullName = `${prenom} ${nom}`.trim();
      if (!fullName || fullName.length < 2) continue;
      checked++;

      const body: Record<string, unknown> = {
        schema: "Person",
        properties: { name: [fullName] },
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
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) continue;

        let data: any;
        try { data = await res.json(); } catch { continue; }
        const responses = data.responses?.default ?? data.results ?? [];

        for (const result of responses) {
          const matchScore = result.score ?? 0;
          if (matchScore < 0.5) continue;

          const datasets = result.datasets ?? [];
          const schema = result.schema ?? "";
          const caption = result.caption ?? result.name ?? "";

          const isPPE = datasets.some((d: string) =>
            d.toLowerCase().includes("pep") ||
            d.toLowerCase().includes("ppe") ||
            d.toLowerCase().includes("politically")
          ) || schema.toLowerCase().includes("pep");

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
      } catch {
        // Non-blocking per person
      }
    }

    // Also check company by SIREN
    if (siren) {
      const cleanSiren = siren.replace(/[\s.\-]/g, "");
      if (!/^\d{9,14}$/.test(cleanSiren)) {
        // Invalid SIREN format — skip company check
      } else try {
        const companyBody = {
          schema: "Company",
          properties: { registrationNumber: [cleanSiren] },
        };
        const res = await fetch("https://api.opensanctions.org/match/default", {
          method: "POST",
          headers,
          body: JSON.stringify(companyBody),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          let data: any;
          try { data = await res.json(); } catch { data = {}; }
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
      status: allMatches.length > 0 ? (hasCriticalMatch ? "ALERTE" : "ATTENTION") : "ok",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[sanctions-check] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: "Erreur interne du service de sanctions", matches: [], checked: 0, status: "unavailable" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
