import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

Deno.serve(async (req) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;
  const cors = getCorsHeaders(req);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Auth : récupérer le user depuis le JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 2. Récupérer les params de la requête
    const {
      client_id,
      lettre_mission_id,
      missions_complementaires,
      honoraires,
      volume_comptable,
      outil_transmission,
      option_controle_fiscal,
      frequence_facturation,
    } = await req.json();

    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id requis" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 3. Charger le profil, cabinet, client
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("*, cabinets(*)")
      .eq("id", user.id)
      .single();
    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Profil introuvable" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const cabinet = profile.cabinets;

    // client_id peut être un UUID ou un ref (ex: "CLI-001") — essayer les deux
    let client: any = null;
    const { data: clientById } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .single();
    client = clientById;
    if (!client) {
      const { data: clientByRef } = await supabase
        .from("clients")
        .select("*")
        .eq("ref", client_id)
        .single();
      client = clientByRef;
    }
    if (!client) {
      return new Response(JSON.stringify({ error: "Client introuvable" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let lm = null;
    if (lettre_mission_id) {
      const { data } = await supabase
        .from("lettres_mission")
        .select("*")
        .eq("id", lettre_mission_id)
        .single();
      lm = data;
    }

    // 4. Charger le template DOCX depuis Storage
    const templatePath = `${cabinet.id}/templates/lm-default.docx`;
    let { data: templateFile } = await supabase.storage
      .from("cabinet-assets")
      .download(templatePath);

    if (!templateFile) {
      // Fallback : template par défaut stocké dans le bucket public
      const { data: defaultTemplate } = await supabase.storage
        .from("cabinet-assets")
        .download("default/lm-default.docx");
      templateFile = defaultTemplate;
    }
    if (!templateFile) {
      return new Response(JSON.stringify({ error: "Template introuvable" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 5. Charger le logo cabinet
    const logoPath = `${cabinet.id}/logo.png`;
    const { data: logoFile } = await supabase.storage
      .from("cabinet-assets")
      .download(logoPath);

    // 6. Construire le dictionnaire de variables
    const civilite = client.civilite || "";
    const formule =
      civilite === "Mme"
        ? "Chère Madame"
        : civilite === "M"
          ? "Cher Monsieur"
          : "Madame, Monsieur";

    const now = new Date();
    const dateFormatted = now.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const variables: Record<string, string> = {
      // Cabinet
      nom_cabinet: cabinet.nom || "",
      adresse_cabinet: cabinet.adresse || "",
      cp_ville_cabinet: `${cabinet.code_postal || ""} ${cabinet.ville || ""}`.trim(),
      ville_cabinet: cabinet.ville || "",
      email_cabinet: cabinet.email || "",
      telephone_cabinet: cabinet.telephone || "",
      siret_cabinet: cabinet.siret || "",
      numero_oec: cabinet.numero_oec || "",
      id_creancier: cabinet.id_sepa || "",
      taux_ec: cabinet.taux_ec || "200 € HT",
      taux_collaborateur: cabinet.taux_collaborateur || "100 € HT",
      ville_tribunal: cabinet.ville_tribunal || "MARSEILLE",
      nom_expert: profile.prenom
        ? `${profile.prenom} ${profile.nom}`
        : profile.nom || "",
      expert_responsable: profile.prenom
        ? `${profile.prenom} ${profile.nom}`
        : profile.nom || "",

      // Client
      civilite: civilite,
      formule_politesse: formule,
      nom_dirigeant: client.dirigeant || "",
      raison_sociale: client.raison_sociale || "",
      forme_juridique: client.forme_juridique || "",
      activite_principale: client.activite || "",
      code_ape: client.code_ape || "",
      siren: client.siren || "",
      capital_social: client.capital_social
        ? `${client.capital_social} €`
        : "",
      date_creation: client.date_creation || "",
      regime_fiscal: client.regime_fiscal || "",
      exercice_debut: client.exercice_debut || `01/01/${now.getFullYear()}`,
      exercice_fin:
        client.date_cloture_exercice || `31/12/${now.getFullYear()}`,
      assujetti_tva: client.assujetti_tva ? "Oui" : "Non",
      cac_designe: client.cac ? "Oui" : "Non",
      effectif: client.effectif?.toString() || "",
      email_client: client.email || "",
      telephone_client: client.telephone || "",
      adresse_client_complete:
        `${client.adresse || ""} ${client.code_postal || ""} ${client.ville || ""}`.trim(),
      nom_client_signature: client.dirigeant || "",
      iban_client: client.iban || "",
      bic_client: client.bic || "",

      // Mission
      numero_lm: lm?.numero || "",
      date_document: dateFormatted,
      date_effet: dateFormatted,
      type_mission: lm?.mission_type || "Présentation des comptes",
      volume_comptable: volume_comptable || "",
      outil_transmission:
        outil_transmission || cabinet.outil_transmission_defaut || "GRIMY",
      periodicite_transmission: frequence_facturation || "MENSUEL",

      // LCB-FT
      score_risque: client.score_risque?.toString() || "",
      niveau_vigilance: client.niveau_vigilance || "",
      statut_ppe: client.statut_ppe || "Non PPE",
      date_derniere_kyc: client.derniere_kyc || dateFormatted,
      date_prochaine_kyc: "",

      // Honoraires
      honoraires_annuels: honoraires?.annuel || "",
      forfait_constitution: honoraires?.setup || "",
      honoraires_juridique: honoraires?.juridique || "",
      prix_bulletin: honoraires?.bulletin || "32 € HT",
      prix_fin_contrat: honoraires?.fin_contrat || "30 € HT",
      prix_contrat_simple: honoraires?.contrat_simple || "100 € HT",
      prix_entree_salarie: honoraires?.entree_salarie || "30 € HT",
      prix_attestation_maladie: honoraires?.attestation || "30 € HT",
      prix_coffre_fort: honoraires?.coffre_fort || "5 € HT",
      prix_bordereaux: honoraires?.bordereaux || "25 € HT",
      prix_sylae: honoraires?.sylae || "15 € HT",

      // Facturation
      frequence_facturation: (() => {
        const freq = frequence_facturation || "MENSUEL";
        if (freq === "MENSUEL") return "Mensuellement";
        if (freq === "TRIMESTRIEL") return "Trimestriellement";
        if (freq === "ANNUEL") return "Annuellement";
        return freq;
      })(),

      // Checkboxes contrôle fiscal
      checkbox_option_a: option_controle_fiscal === "A" ? "☒" : "☐",
      checkbox_option_b: option_controle_fiscal === "B" ? "☒" : "☐",
      checkbox_renonce: option_controle_fiscal === "none" ? "☒" : "☐",
    };

    // 7. Ouvrir le DOCX (c'est un ZIP), remplacer les variables
    const zip = await JSZip.loadAsync(await templateFile.arrayBuffer());

    // Fichiers XML à traiter
    const xmlFiles = [
      "word/document.xml",
      "word/header1.xml",
      "word/header2.xml",
      "word/footer1.xml",
      "word/footer2.xml",
    ];

    for (const path of xmlFiles) {
      const file = zip.file(path);
      if (!file) continue;
      let content = await file.async("string");

      // Remplacer toutes les {{variables}}
      for (const [key, value] of Object.entries(variables)) {
        const escaped = escapeXml(value);
        // Remplacement simple
        content = content.replaceAll(`{{${key}}}`, escaped);
        // Remplacement avec tags XML intercalés (Word fragmente souvent le texte)
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const splitRegex = new RegExp(
          "\\{\\{" +
            escapedKey
              .split("")
              .join("(?:</w:t></w:r><w:r[^>]*><w:t[^>]*>)?") +
            "\\}\\}",
          "g"
        );
        content = content.replace(splitRegex, escaped);
      }

      // Sections conditionnelles : supprimer les blocs non activés
      const missions = missions_complementaires || [];
      if (!missions.includes("sociale")) {
        content = removeSectionBlock(content, "section_sociale");
      }
      if (!missions.includes("juridique")) {
        content = removeSectionBlock(content, "section_juridique");
      }
      if (!missions.includes("controle_fiscal")) {
        content = removeSectionBlock(content, "section_controle_fiscal");
      }

      // Nettoyer les balises de section restantes
      content = content.replace(/\{\{#[^}]+\}\}/g, "");
      content = content.replace(/\{\{\/[^}]+\}\}/g, "");

      zip.file(path, content);
    }

    // 8. Remplacer le logo si disponible
    if (logoFile) {
      const logoBuffer = await logoFile.arrayBuffer();
      zip.file("word/media/image1.png", logoBuffer);
    }

    // 9. Générer le DOCX final
    const docxBuffer = await zip.generateAsync({ type: "arraybuffer" });

    // 10. Sauvegarder dans Storage et retourner
    const outputFilename = `LDM_${lm?.numero || "DRAFT"}_${now.toISOString().slice(0, 10)}.docx`;
    const outputPath = `${cabinet.id}/lettres-mission/${outputFilename}`;

    await supabase.storage.from("cabinet-assets").upload(outputPath, docxBuffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

    return new Response(docxBuffer, {
      headers: {
        ...cors,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${outputFilename}"`,
      },
    });
  } catch (err) {
    console.error("generate-lm error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erreur interne" }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function removeSectionBlock(content: string, sectionName: string): string {
  const regex = new RegExp(
    `\\{\\{#${sectionName}\\}\\}[\\s\\S]*?\\{\\{\\/${sectionName}\\}\\}`,
    "g"
  );
  return content.replace(regex, "");
}
