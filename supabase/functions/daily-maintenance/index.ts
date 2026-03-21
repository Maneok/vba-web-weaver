import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabase.rpc('daily_full_maintenance');

  const result: Record<string, unknown> = { ...(typeof data === 'object' && data !== null ? data : { rpc: data }) };

  // Pre-warm gel-avoirs cache (DGTrésor JSON feed)
  try {
    const gelRes = await fetch(
      "https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-fichier-json",
      { headers: { "User-Agent": "GRIMY-LCB-Compliance/1.0" }, signal: AbortSignal.timeout(45000) }
    );
    if (gelRes.ok) {
      const gelData = await gelRes.json();
      const items = gelData?.Publications?.PublicationDetail ?? [];
      const publicationDate = gelData?.Publications?.DatePublication ?? "";

      await supabase.from("api_cache").upsert({
        siren: "GEL_AVOIRS_GLOBAL",
        api_name: "gel_avoirs",
        cabinet_id: "00000000-0000-0000-0000-000000000000",
        response_data: { items, publicationDate },
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "siren,api_name,cabinet_id" });

      result.gel_avoirs_cache = { refreshed: true, entries: items.length, publicationDate };
      console.log(`[daily-maintenance] Gel-avoirs cache refreshed: ${items.length} entries`);
    } else {
      result.gel_avoirs_cache = { refreshed: false, error: `HTTP ${gelRes.status}` };
    }
  } catch (err) {
    result.gel_avoirs_cache = { refreshed: false, error: (err as Error).message };
    console.error("[daily-maintenance] Gel-avoirs cache refresh failed:", (err as Error).message);
  }

  // === Vérification des CNI qui expirent dans 30 jours ===
  try {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: expiringCni } = await supabase
      .from("clients")
      .select("ref, raison_sociale, date_exp_cni, cabinet_id")
      .neq("date_exp_cni", "")
      .not("date_exp_cni", "is", null)
      .lte("date_exp_cni", thirtyDaysFromNow)
      .neq("etat", "ARCHIVE");

    if (expiringCni && expiringCni.length > 0) {
      for (const client of expiringCni) {
        await supabase.from("notifications").upsert({
          cabinet_id: client.cabinet_id,
          type: "EXPIRATION_CNI",
          titre: `CNI expirante : ${client.raison_sociale}`,
          message: `La CNI du client ${client.raison_sociale} (${client.ref}) expire le ${client.date_exp_cni}. Veuillez demander un renouvellement.`,
          client_ref: client.ref,
          priority: "HAUTE",
        }, { onConflict: "cabinet_id,type,client_ref", ignoreDuplicates: true });
      }
      result.expiring_cni = { count: expiringCni.length, refs: expiringCni.map((c: any) => c.ref) };
    } else {
      result.expiring_cni = { count: 0 };
    }
  } catch (err) {
    result.expiring_cni = { error: (err as Error).message };
  }

  // === Vérification des dates butoir dépassées → passer en RETARD ===
  try {
    const today = new Date().toISOString().split("T")[0];
    const { data: overdue } = await supabase
      .from("clients")
      .select("ref, raison_sociale, date_butoir, cabinet_id, niv_vigilance")
      .neq("date_butoir", "")
      .not("date_butoir", "is", null)
      .lte("date_butoir", today)
      .neq("etat", "ARCHIVE")
      .neq("etat_pilotage", "RETARD");

    if (overdue && overdue.length > 0) {
      for (const client of overdue) {
        await supabase.from("clients")
          .update({ etat_pilotage: "RETARD", updated_at: new Date().toISOString() })
          .eq("ref", client.ref)
          .eq("cabinet_id", client.cabinet_id);

        await supabase.from("notifications").upsert({
          cabinet_id: client.cabinet_id,
          type: "RETARD_REVUE",
          titre: `Revue en retard : ${client.raison_sociale}`,
          message: `La revue du client ${client.raison_sociale} (${client.ref}) est en retard. Date butoir : ${client.date_butoir}. Vigilance : ${client.niv_vigilance}.`,
          client_ref: client.ref,
          priority: client.niv_vigilance === "RENFORCEE" ? "HAUTE" : "NORMAL",
        }, { onConflict: "cabinet_id,type,client_ref", ignoreDuplicates: true });
      }
      result.overdue_reviews = { count: overdue.length, refs: overdue.map((c: any) => c.ref) };
    } else {
      result.overdue_reviews = { count: 0 };
    }
  } catch (err) {
    result.overdue_reviews = { error: (err as Error).message };
  }

  // === Clients "BIENTOT" (date_butoir dans les 60 prochains jours) ===
  try {
    const today = new Date().toISOString().split("T")[0];
    const sixtyDays = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: upcoming } = await supabase
      .from("clients")
      .select("ref, cabinet_id")
      .gt("date_butoir", today)
      .lte("date_butoir", sixtyDays)
      .neq("etat", "ARCHIVE")
      .eq("etat_pilotage", "A JOUR");

    if (upcoming && upcoming.length > 0) {
      for (const client of upcoming) {
        await supabase.from("clients")
          .update({ etat_pilotage: "BIENTOT", updated_at: new Date().toISOString() })
          .eq("ref", client.ref)
          .eq("cabinet_id", client.cabinet_id);
      }
      result.upcoming_reviews = { count: upcoming.length };
    } else {
      result.upcoming_reviews = { count: 0 };
    }
  } catch (err) {
    result.upcoming_reviews = { error: (err as Error).message };
  }

  // === Auto-créer les revues de maintien pour les dossiers éligibles ===
  try {
    const { data: activeClients } = await supabase
      .from("clients")
      .select("id, ref, raison_sociale, cabinet_id, niv_vigilance, date_derniere_revue, date_creation_ligne, score_global")
      .eq("statut", "ACTIF");

    if (activeClients) {
      let createdCount = 0;
      for (const client of activeClients) {
        const { data: isDue } = await supabase.rpc("is_review_due", {
          p_vigilance: client.niv_vigilance || "STANDARD",
          p_derniere_revue: client.date_derniere_revue || "",
          p_date_creation: client.date_creation_ligne || "",
        });

        if (isDue) {
          // Check no existing pending review
          const { data: existingRevue } = await supabase
            .from("revue_maintien")
            .select("id")
            .eq("client_id", client.id)
            .in("status", ["a_faire", "en_cours"])
            .limit(1);

          if (!existingRevue || existingRevue.length === 0) {
            await supabase.from("revue_maintien").insert({
              cabinet_id: client.cabinet_id,
              client_id: client.id,
              type: client.niv_vigilance === "RENFORCEE" ? "risque_eleve" : "annuelle",
              status: "a_faire",
              date_echeance: new Date().toISOString().split("T")[0],
              score_risque_avant: client.score_global || 0,
              vigilance_avant: client.niv_vigilance || "STANDARD",
            });

            await supabase.from("notifications").insert({
              cabinet_id: client.cabinet_id,
              type: "REVUE_DUE",
              titre: `Revue de maintien requise : ${client.raison_sociale}`,
              message: `La revue de maintien du client ${client.raison_sociale} (${client.ref}) est à réaliser. Vigilance : ${client.niv_vigilance}.`,
              client_ref: client.ref,
              priority: client.niv_vigilance === "RENFORCEE" ? "HAUTE" : "NORMAL",
            }).then(() => {}).catch(() => {});

            createdCount++;
          }
        }
      }
      result.auto_reviews = { created: createdCount };
    }
  } catch (err) {
    result.auto_reviews = { error: (err as Error).message };
  }

  // === Suspension des trials expirés ===
  try {
    const { data: expiredTrials } = await supabase
      .from("cabinet_subscriptions")
      .select("id, cabinet_id, trial_end")
      .eq("status", "trialing")
      .lte("trial_end", new Date().toISOString());

    if (expiredTrials && expiredTrials.length > 0) {
      for (const trial of expiredTrials) {
        await supabase.from("cabinet_subscriptions")
          .update({ status: "suspended", updated_at: new Date().toISOString() })
          .eq("id", trial.id);
      }
      result.expired_trials = { suspended: expiredTrials.length };
    } else {
      result.expired_trials = { suspended: 0 };
    }
  } catch (err) {
    result.expired_trials = { error: (err as Error).message };
  }

  // === NOUVELLES TÂCHES CÂBLÉES AUX RÉGLAGES ===

  // Auto-génération des maintiens de mission
  try {
    const { data: maintiens } = await supabase.rpc('auto_generate_maintiens');
    result.maintiens_generated = maintiens || 0;
  } catch (err) {
    result.maintiens_generated = { error: (err as Error).message };
  }

  // Auto-archivage des LM signées anciennes
  try {
    const { data: archived } = await supabase.rpc('auto_archive_lettres');
    result.lettres_archived = archived || 0;
  } catch (err) {
    result.lettres_archived = { error: (err as Error).message };
  }

  // Purge des brouillons anciens
  try {
    const { data: purged } = await supabase.rpc('auto_purge_brouillons');
    result.brouillons_purged = purged || 0;
  } catch (err) {
    result.brouillons_purged = { error: (err as Error).message };
  }

  // Notifications câblées aux réglages (par cabinet)
  try {
    const { data: cabinets } = await supabase
      .from('cabinet_reglages')
      .select('cabinet_id');
    let totalNotifs = 0;
    for (const cab of cabinets || []) {
      try {
        const { data: count } = await supabase.rpc('generate_notifications', { p_cabinet_id: cab.cabinet_id });
        totalNotifs += (count || 0);
      } catch { /* skip cabinet on error */ }
    }
    result.notifications_generated = totalNotifs;
  } catch (err) {
    result.notifications_generated = { error: (err as Error).message };
  }

  return new Response(JSON.stringify({ success: !error, result, error: error?.message }), {
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
});
