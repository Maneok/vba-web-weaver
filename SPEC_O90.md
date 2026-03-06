# SPEC_O90 — Cahier des Charges Technique
## Reproduction fidèle du tableur O90 LCB-FT en application web

**Auteur original du tableur :** Alexandre DAHAN (mémoire DEC – session mai 2026)
**Objectif :** Reproduire à 100 % la logique métier, les données et les automatismes du fichier `O90_Tableur_Pilotage_LCBFT.xlsm` sous forme d'application web React/TypeScript + Supabase.

---

## 1. ARCHITECTURE GÉNÉRALE

Le classeur contient **11 feuilles** :

| Feuille | Rôle | Lignes | Colonnes | Priorité |
|---------|------|--------|----------|----------|
| **BDD** | Base clients principale | 30 clients (lignes 5-34, headers ligne 4) | 52 colonnes (A-AZ) | CRITIQUE |
| **PARAM** | Tables de référence / paramétrage | 122 lignes | 59 colonnes | CRITIQUE |
| **DASHBORD** | Tableau de bord KPI (TCD) | Dynamique | - | HAUTE |
| **CALC_DASH** | Calculs intermédiaires pour dashboard | 219 lignes | 15 colonnes | HAUTE |
| **CONTROLE** | Module de contrôle qualité / audit | 11 lignes | 28 colonnes | HAUTE |
| **REGISTRE_LCB** | Registre des alertes et déclarations | 8 lignes | 13 colonnes | HAUTE |
| **GOUV** | Gouvernance / équipe / formations | 16 lignes | 10 colonnes | HAUTE |
| **LOGS** | Journal d'audit (mouchard) | 159 entrées | 6 colonnes | HAUTE |
| **FICHE_LCB** | Fiche de synthèse client (template PDF) | 55 lignes | 13 colonnes | MOYENNE |
| **NOTICE** | Documentation utilisateur | 64 lignes | 14 colonnes | BASSE |
| **ORGANIGRAMME** | Organigramme du cabinet | 7 lignes | 7 colonnes | BASSE |
| **DATA_PPTM** | Données embarquées présentation | 269 lignes | 2 colonnes | BASSE |

---

## 2. FEUILLE BDD — BASE CLIENTS (52 colonnes)

### 2.1 Structure des colonnes

| Col | Lettre | Nom | Type | Obligatoire | Description |
|-----|--------|-----|------|-------------|-------------|
| 1 | A | REF | Texte | OUI | Référence unique (format CLI-26-XXX) |
| 2 | B | ETAT | Liste | OUI | PROSPECT / EN COURS / VALIDE / REFUSE / ARCHIVE |
| 3 | C | COMPTABLE | Liste | OUI | Collaborateur assigné (MAGALIE, JULIEN, FANNY, SERGE, JOSE) |
| 4 | D | MISSION | Liste | OUI | Type de mission (cf. PARAM col K) |
| 5 | E | RAISON SOCIALE | Texte | OUI | Nom de la société |
| 6 | F | FORME | Liste | OUI | Forme juridique (EI, SARL, SAS, SCI, SCP, etc.) |
| 7 | G | ADRESSE | Texte | OUI | Adresse postale |
| 8 | H | CP | Texte | OUI | Code postal |
| 9 | I | VILLE | Texte | OUI | Ville |
| 10 | J | SIREN | Texte | OUI | Numéro SIREN (9 chiffres, espaces autorisés) |
| 11 | K | CAPITAL | Nombre | NON | Capital social en euros |
| 12 | L | APE | Texte | OUI | Code APE/NAF (format XX.XXX) |
| 13 | M | DIRIGEANT | Texte | OUI | NOM Prénom du dirigeant |
| 14 | N | DOMAINE | Texte | NON | Description de l'activité |
| 15 | O | EFFECTIF | Liste | NON | Tranche d'effectif |
| 16 | P | TEL | Texte | NON | Téléphone (format 0XXXXXXXXX) |
| 17 | Q | MAIL | Texte | NON | Email |
| 18 | R | DATE CREATION | Date | OUI | Date de création de la société |
| 19 | S | DATE REPRISE | Date | NON | Date de reprise par le cabinet |
| 20 | T | HONORAIRES | Nombre | OUI | Honoraires annuels HT |
| 21 | U | REPRISE | Nombre | NON | Frais de reprise |
| 22 | V | JURIDIQUE | Nombre | NON | Honoraires juridique |
| 23 | W | FREQUENCE | Liste | OUI | MENSUEL / TRIMESTRIEL / ANNUEL |
| 24 | X | IBAN | Texte | OUI | IBAN (format FR76...) |
| 25 | Y | BIC | Texte | OUI | Code BIC/SWIFT |
| 26 | Z | ASSOCIE | Liste | OUI | Associé signataire (DIDIER, PASCAL, KEVIN) |
| 27 | AA | SUPERVISEUR | Liste | OUI | Superviseur (SAMUEL, BRAYAN) |
| 28 | AB | PPE | Liste | OUI | Personne Politiquement Exposée (OUI/NON) |
| 29 | AC | PAYS RISQUE | Liste | OUI | Pays à risque (OUI/NON) |
| 30 | AD | ATYPIQUE | Liste | OUI | Client atypique (OUI/NON) |
| 31 | AE | DISTANCIEL | Liste | OUI | Relation distancielle (OUI/NON) |
| 32 | AF | CASH | Liste | OUI | Secteur espèces (OUI/NON) |
| 33 | AG | PRESSION | Liste | OUI | Pression/urgence suspecte (OUI/NON) |
| 34 | AH | SCORE ACTIVITE | Nombre | CALCULE | Score risque activité (0-100) |
| 35 | AI | SCORE PAYS | Nombre | CALCULE | Score risque pays (0-100) |
| 36 | AJ | SCORE MISSION | Nombre | CALCULE | Score risque mission (0-100) |
| 37 | AK | SCORE MATURITE | Nombre | CALCULE | Score risque maturité (0-100) |
| 38 | AL | SCORE STRUCTURE | Nombre | CALCULE | Score risque structure juridique (0-100) |
| 39 | AM | MALUS | Nombre | CALCULE | Total malus contextuels (0-100+) |
| 40 | AN | SCORE GLOBAL | Nombre | CALCULE | Score global pondéré (0-120+) |
| 41 | AO | NIV VIGILANCE | Texte | CALCULE | SIMPLIFIEE / STANDARD / RENFORCEE |
| 42 | AP | DATE CREATION LIGNE | Date | AUTO | Date de saisie initiale |
| 43 | AQ | LIEN KBIS | Lien | NON | Hyperlien vers document Kbis (GED) |
| 44 | AR | LIEN STATUTS | Lien | NON | Hyperlien vers statuts (GED) |
| 45 | AS | LIEN CNI | Lien | NON | Hyperlien vers pièce d'identité (GED) |
| 46 | AT | DATE_DERNIERE_REVUE | Date | OUI | Date du dernier examen LCB-FT |
| 47 | AU | DATE_BUTOIR_REVUE | Date | CALCULE | Date limite prochain examen |
| 48 | AV | ETAT_PILOTAGE | Texte | CALCULE | A JOUR / EN RETARD / CRITIQUE |
| 49 | AW | DATE_EXP_CNI | Date | NON | Date expiration pièce d'identité |
| 50 | AX | STATUT | Liste | OUI | ACTIF / INACTIF |
| 51 | AY | BE | Texte | NON | Bénéficiaires effectifs (NOM + %) |
| 52 | AZ | DATE FIN | Date | NON | Date de fin de mission |

### 2.2 Les 30 clients fictifs

| REF | Raison Sociale | Score | Vigilance |
|-----|---------------|-------|-----------|
| CLI-26-001 | BOULANGERIE MARTIN | 13 | SIMPLIFIEE |
| CLI-26-002 | CABINET MEDICAL DR LEFEBVRE | 12 | SIMPLIFIEE |
| CLI-26-003 | KLIK COMMERCE | 21 | SIMPLIFIEE |
| CLI-26-004 | IMMO PROVENCE TRANSACTIONS | 25 | STANDARD |
| CLI-26-005 | FAST BURGER REPUBLIC | 28 | STANDARD |
| CLI-26-006 | SCI LES OLIVIERS | 80 | RENFORCEE |
| CLI-26-007 | STRATEGO PARTNERS | 19 | RENFORCEE |
| CLI-26-008 | IMPORT EXPORT MEDINA | 100 | RENFORCEE |
| CLI-26-009 | ATLAS HOLDING INVESTISSEMENTS | 80 | RENFORCEE |
| CLI-26-010 | MAÇONNERIE DELMAS & FILS | 18 | SIMPLIFIEE |
| CLI-26-011 | PHARMACIE DE LA GARE | 12 | SIMPLIFIEE |
| CLI-26-012 | HOTEL LE CLOITRE | 20 | SIMPLIFIEE |
| CLI-26-013 | AUTO PRESTIGE MEDITERRANEE | 37 | STANDARD |
| CLI-26-014 | COIFFURE TENDANCE NATHALIE | 12 | SIMPLIFIEE |
| CLI-26-015 | JOAILLERIE DORVAL | 80 | RENFORCEE |
| CLI-26-016 | TECH CONSEIL & EXPERTISE | 17 | SIMPLIFIEE |
| CLI-26-017 | BRASSERIE DU PORT | 20 | SIMPLIFIEE |
| CLI-26-018 | BUREAUX & TERRITOIRES DÉVELOPPEMENT | 40 | STANDARD |
| CLI-26-019 | ARCHITECTES ASSOCIÉS DU SUD | 12 | SIMPLIFIEE |
| CLI-26-020 | FINPART INVEST | 37 | STANDARD |
| CLI-26-021 | FLEURS & CRÉATIONS LAURE | 12 | SIMPLIFIEE |
| CLI-26-022 | ACTIFS PREMIUM TRANSACTIONS | 80 | RENFORCEE |
| CLI-26-023 | TRANSPORTS AURIOL FRÈRES | 11 | SIMPLIFIEE |
| CLI-26-024 | GLOBAL RESSOURCES CONSEIL | 100 | RENFORCEE |
| CLI-26-025 | EARL DU MAS DE LA VIGNE | 8 | SIMPLIFIEE |
| CLI-26-026 | CABINET DENTAIRE MORIN ET ASSOCIÉS | 12 | SIMPLIFIEE |
| CLI-26-027 | FOREX TRADING EXPERTISES | 90 | RENFORCEE |
| CLI-26-028 | ÉPICERIE DU MARCHÉ HAMID | 12 | SIMPLIFIEE |
| CLI-26-029 | PIXEL & COMMUNICATION CRÉATIVE | 21 | SIMPLIFIEE |
| CLI-26-030 | CRYPTO ASSET MANAGEMENT | 120 | RENFORCEE |

---

## 3. ALGORITHME DE SCORING MULTICRITÈRE (6 AXES)

### 3.1 Vue d'ensemble

Le score global est calculé sur une échelle de 0 à 120+ via 6 axes indépendants, chacun pondéré, plus des malus contextuels.

```
SCORE_GLOBAL = Pondération(SCORE_ACTIVITE, SCORE_PAYS, SCORE_MISSION, SCORE_MATURITE, SCORE_STRUCTURE) + MALUS
```

### 3.2 Axe 1 — Score Activité (basé sur le code APE)

Table de correspondance CODE_APE → SCORE → RISQUE :

| Code APE | Score | Description risque |
|----------|-------|-------------------|
| 41.10A | 30 | Promotion immobilière logements |
| 41.10B | 70 | Promotion immobilière bureaux |
| 41.20A | 40 | Construction maisons individuelles |
| 43.99C | 40 | Maçonnerie générale |
| 45.11Z | 50 | Commerce de voitures (Cash/TVA) |
| 45.19Z | 50 | Commerce autres véhicules |
| 45.20A | 30 | Réparation véhicules |
| 46.73A | 30 | Commerce gros bois (TVA) |
| 47.73Z | 20 | Pharmacie |
| 47.77Z | 80 | Horlogerie/bijouterie (Luxe/Cash) |
| 55.10Z | 30 | Hôtels |
| 56.10A | 30 | Restauration traditionnelle |
| 56.10C | 60 | Restauration rapide (Fort Cash) |
| 56.30Z | 50 | Débits de boissons |
| 64.19Z | 50 | Intermédiation monétaire |
| 64.20Z | 40 | Holdings |
| 66.19B | 50 | Services financiers auxiliaires |
| 68.10Z | 80 | Marchands de biens (Blanchiment immo) |
| 68.20A | 30 | Location logements |
| 68.20B | 30 | Location terrains |
| 68.31Z | 70 | Agences immobilières |
| 70.22Z | 25 | Conseil affaires |
| 77.11A | 40 | Location voitures (Luxe) |
| 82.99Z | 60 | Domiciliation |
| 90.03B | 60 | Création artistique (Œuvres d'art) |
| 92.00Z | 100 | Jeux de hasard |
| 93.29Z | 40 | Activités récréatives |

**Si le code APE n'est pas dans la table, score par défaut = 25 (DEF_SCORE_ACT dans PARAM).**

### 3.3 Axe 2 — Score Pays

| Pays | Score | Catégorie |
|------|-------|-----------|
| RAS / AUCUN | 0 | Aucun risque |
| RPDC (Corée du Nord) | 100 | NOIRE (liste GAFI) |
| IRAN | 100 | NOIRE |
| MYANMAR | 100 | NOIRE |
| ALGÉRIE | 75 | GRISE |
| ANGOLA | 75 | GRISE |
| BOLIVIE | 75 | GRISE |
| BULGARIE | 75 | GRISE |
| CAMEROUN | 75 | GRISE |
| CÔTE D'IVOIRE | 75 | GRISE |
| RÉP. DÉM. DU CONGO | 75 | GRISE |
| HAÏTI | 75 | GRISE |
| KENYA | 75 | GRISE |
| RÉP. DÉM. POP. LAO | 75 | GRISE |
| LIBAN | 75 | GRISE |
| MONACO | 75 | GRISE |
| NAMIBIE | 75 | GRISE |
| NÉPAL | 75 | GRISE |
| SOUDAN DU SUD | 75 | GRISE |
| SYRIE | 75 | GRISE |
| VENEZUELA | 75 | GRISE |
| VIETNAM | 75 | GRISE |
| ÎLES VIERGES BRITANNIQUES | 75 | GRISE |
| YÉMEN | 75 | GRISE |

### 3.4 Axe 3 — Score Mission

| Type de mission | Score | Justification |
|----------------|-------|---------------|
| TENUE COMPTABLE | 10 | Vision totale des flux |
| REVISION / SURVEILLANCE | 30 | Contrôle partiel, risque masquage |
| SOCIAL / PAIE SEULE | 10 | Flux normés |
| CONSEIL DE GESTION | 40 | Risque prévisionnels complaisants |
| CONSTITUTION / CESSION | 60 | Origine des fonds critique |
| DOMICILIATION | 80 | Société écran, opacité totale |
| IRPP | 20 | Risque faible |

### 3.5 Axe 4 — Score Maturité (Calculé par VBA)

Logique `DeterminerScoreMaturite()` :

| Code | Score | Condition |
|------|-------|-----------|
| MAT_INTERNE | 10 | Création par le cabinet (checkbox cochée) |
| MAT_EXT_1AN | 65 | Reprise + ancienneté ≤ 1 an |
| MAT_EXT_3ANS | 50 | Reprise + ancienneté ≤ 3 ans |
| MAT_STABLE | Calculé | Reprise + ancienneté > 3 ans → base 25 ajustée |
| MAT_DORMANT | 80 | Ancienneté > 3 ans mais aucune activité comptable |

**Formule précise :** 
- Si création par le cabinet → 10
- Si reprise et ancienneté ≤ 12 mois → 65
- Si reprise et ancienneté ≤ 36 mois → 50
- Si reprise et ancienneté > 36 mois → 25 (ajustable)
- Cas dormant (pas de reprise, pas de création) → 80

### 3.6 Axe 5 — Score Structure Juridique (Calculé par VBA)

Logique `DeterminerScoreFormeJuridique()` :

| Code | Score | Formes détectées | Explication |
|------|-------|-----------------|-------------|
| STRUCT_TRANSPARENTE | 0 | EI, LIBERALE, ARTISAN, AUTO, MICRO | Transparence totale |
| STRUCT_STANDARD | 20 | SARL, EURL | Standard, risque modéré |
| STRUCT_REGLEMENTEE | 30 | SEL, SELARL, SELAS, SCP | Profession réglementée |
| STRUCT_PATRIMOINE | 35 | SCI, CIVILE | Risque patrimonial |
| STRUCT_CAPITAUX | 40 | SAS, SA | Capitaux importants |
| STRUCT_OPAQUE | 50 | ASSOCIATION | Opacité possible |
| STRUCT_INTERDIT | 100 | TRUST, FIDUCIE, FONDATION | Interdit / très haut risque |

### 3.7 Malus Contextuels

| Code malus | Score | Condition | Colonne BDD |
|-----------|-------|-----------|-------------|
| CTX_DISTANCIEL | 40 | Relation 100% distancielle | Col 31 = OUI |
| CTX_CASH | 30 | Secteur manipulant des espèces | Col 32 = OUI |
| CTX_PRESSION | 50 | Pression/urgence suspecte | Col 33 = OUI |
| MALUS_ATYPIQUE | 100 | Client atypique (forçage renforcé) | Col 30 = OUI |
| SCORE_PPE | 100 | Personne politiquement exposée | Col 28 = OUI |

**Cumul des malus :** Les malus sont additifs. Un client PPE + Cash + Distanciel = 100 + 30 + 40 = 170.

### 3.8 Score Global et Niveaux de Vigilance

**Formule :**
```
SCORE_GLOBAL = moyenne_pondérée(5 axes) + somme(malus)
```

**Seuils (définis dans PARAM col AM-AN) :**

| Seuil | Valeur | Vigilance |
|-------|--------|-----------|
| SEUIL_BAS | 25 | ≤ 25 → SIMPLIFIEE |
| SEUIL_HAUT | 60 | > 25 et ≤ 60 → STANDARD |
| Au-delà | >60 | → RENFORCEE |
| SEUIL_CRITIQUE | 60 | Si UN SEUL axe dépasse ce seuil → force RENFORCEE |

**Règle de forçage :** Si PPE=OUI, PAYS_RISQUE=OUI, ou ATYPIQUE=OUI → vigilance RENFORCEE automatique, quel que soit le score.

---

## 4. FEUILLE GOUV — GOUVERNANCE (10 colonnes)

| Col | Nom | Description |
|-----|-----|-------------|
| 1 | COLLABORATEUR | Nom du collaborateur |
| 2 | FONCTION / RÔLE | ASSOCIE SIGNATAIRE / SUPERVISEUR / COLLABORATEUR / STAGIAIRE / ALTERNANT |
| 3 | RÉFÉRENT LCB ? | OUI/NON |
| 4 | SUPPLÉANT DÉSIGNÉ | Nom du suppléant |
| 5 | NIVEAU COMPÉTENCE | NIVEAU 1 (JUNIOR) / NIVEAU 2 (CONFIRMÉ) / NIVEAU 3 (EXPERT) |
| 6 | DATE SIGNATURE MANUEL LAB | Date signature du Manuel Interne LCB-FT |
| 7 | DERNIÈRE FORMATION LAB | Date dernière formation |
| 8 | STATUT FORMATION | ✅ A JOUR / 🔴 A FORMER / ⚠️ JAMAIS FORMÉ |
| 9 | EMAIL PRO | Adresse email |
| 10 | RELANCER LE | Bouton relance email / "EMAIL MANQUANT" |

**Données actuelles : 10 collaborateurs** (JULIEN, BRAYAN, DIDIER, JOSE, MAGALIE, PASCAL, SERGE, FANNY + doublons rôles)

---

## 5. FEUILLE CONTROLE — MODULE D'AUDIT (28 colonnes)

Tirage aléatoire d'un échantillon de dossiers pour contrôle qualité.

**Headers (ligne 5) :**
DATE DU TIRAGE | DOSSIER AUDITÉ | SIREN | FORME | KBIS | STATUTS | CNI | PPE | PAYS RISQUE | ATYPIQUE | CASH | VIGILANCE | SCORE | ... (jusqu'à 28 colonnes avec résultats de contrôle)

**Logique VBA `GenererEchantillon_FINAL_SIREN` :**
- Tire aléatoirement 5 dossiers parmi les clients VALIDES
- Vérifie la présence de chaque document (KBIS, Statuts, CNI)
- Contrôle la cohérence du scoring
- Génère un rapport de contrôle

---

## 6. FEUILLE REGISTRE_LCB — REGISTRE DES ALERTES (13 colonnes)

**Headers (ligne 5) :**

| Col | Nom | Description |
|-----|-----|-------------|
| 1 | DATE | Date de l'alerte |
| 2 | CLIENT CONCERNÉ | Nom du client |
| 3 | CATÉGORIE | Type d'alerte (voir ci-dessous) |
| 4 | GUIDE | Texte d'aide contextuel |
| 5 | DETAILS | Description libre |
| 6 | ACTION PRISE | SOUPCON CARACTERISE / DOUTE LEVE / EN INVESTIGATION |
| 7 | RESPONSABLE | Qui traite l'alerte |
| 8 | QUALIFICATIONS | - |
| 9 | STATUT | EN COURS / CLÔTURÉ |
| 10 | DATE ECHEANCE | Date limite de traitement |

**Catégories d'alertes :**
- ❌ ADMIN : KYC Incomplet
- 🔧 INTERNE : Erreur Procédure
- 📉 FLUX : Incohérence / Atypique
- 🔍 SOUPCON : Tracfin potentiel
- ⚠️ EXTERNE : Gel des avoirs / Sanctions

---

## 7. FEUILLE LOGS — JOURNAL D'AUDIT (6 colonnes)

| Col | Nom | Description |
|-----|-----|-------------|
| 1 | HORODATAGE | Date (format date Excel) |
| 2 | UTILISATEUR | Heure + nom utilisateur |
| 3 | REF_CLIENT | Référence ou module concerné |
| 4 | TYPE_ACTION | Code action (MODIFICATION MANUELLE, CREATION, etc.) |
| 5 | DÉTAILS | Description détaillée |
| 6 | - | Colonne réservée |

**Le mouchard VBA `AjouterLog()` :** Déclenché automatiquement à chaque modification des colonnes sensibles (24=IBAN, 40=Score, 41=Vigilance).

---

## 8. FEUILLE PARAM — PARAMÉTRAGE (59 colonnes)

Tables de référence regroupées par blocs :

| Bloc | Colonnes | Contenu |
|------|----------|---------|
| Etats dossier | A | PROSPECT, EN COURS, VALIDE, REFUSE, ARCHIVE |
| Comptables | C | MAGALIE, JULIEN, FANNY, SERGE, JOSE |
| Associés | E | DIDIER, PASCAL, KEVIN |
| Superviseurs | G | SAMUEL S., BRAYAN D. |
| Fréquences | I | MENSUEL, TRIMESTRIEL, ANNUEL |
| Types mission | K-M | 7 types + score + justification |
| Codes APE | O-Q | 27+ codes + score + description risque |
| Pays à risque | S-U | 25 pays + score + catégorie (NOIRE/GRISE) |
| Maturité | W-Y | 6 niveaux + score + explication |
| Structure | AA-AC | 8 niveaux + score + explication |
| Malus distanciel | AE-AG | 3 malus + score + commentaire |
| Malus espèces/pression | AI-AK | 3 malus + valeur + commentaire |
| Seuils scoring | AM-AO | SEUIL_BAS=25, SEUIL_HAUT=60, SEUIL_CRITIQUE=60 |
| Codes paramètres | AQ-AS | DEF_SCORE_ACT=25, MALUS_ATYPIQUE=100, SCORE_PPE=100 |
| Etats suivi | AU | VALIDE, A REVOIR |
| Balises Word | AW-AX | Mapping balises → colonnes BDD pour lettre de mission |
| LM LAB | AZ-BA | SIMPLIFIEE/STANDARD/RENFORCEE + commentaires réglementaires |

---

## 9. MODULES VBA PRINCIPAUX (248 procédures)

### 9.1 USF_Client (UserForm nouveau client)
- **Formulaire complet** avec ~30 champs
- **Validation en temps réel** : SIREN (9 chiffres), téléphone, email, dates
- **Bouton API** (`btn_API_Click`) : recherche automatique via Pappers API (SIREN → données société)
- **Bouton Sherlock** (`btn_Sherlock_Click`) : ouvre recherche Google/Maps/Pappers
- **Calcul automatique** du scoring à chaque modification (`Calculer_Risque`)
- **GED intégrée** : upload KBIS, Statuts, CNI avec hyperliens (`EcrireLienExcel`)
- **Génération automatique** de la fiche LCB-FT en PDF (`RemplirFicheLCB` + `SauvegarderFicheEnPDF`)

### 9.2 USF_SUIVI (UserForm suivi client existant)
- **Sélection client** via dropdown
- **Même logique** que USF_Client mais en mode édition
- **Lecture intelligente** des liens GED existants (`LireLienIntelligent`)
- **Mise à jour** du scoring et régénération PDF

### 9.3 Module LETTREMISSION
- **`GenererLettreMission()`** : génère une lettre de mission Word à partir d'un template
- **Mail merge** avec 30+ balises : «Ref_Client», «Nom», «Forme_Juridique», etc.
- **Bloc LCB-FT** dynamique selon le niveau de vigilance
- **Architecture "Coupure de Cordon"** : le template Word n'est jamais modifié directement

### 9.4 Module ECHANTILLON
- **`GenererEchantillon_FINAL_SIREN()`** : tirage aléatoire de 5 dossiers
- Vérification complétude documentaire
- Écriture dans la feuille CONTROLE

### 9.5 Module LOGS
- **`AjouterLog()`** : écriture horodatée dans la feuille LOGS
- Déclenché par événements VBA et modifications manuelles

### 9.6 Module RELANCE
- **`RelanceFormation_ULTIME_V2()`** : envoi d'emails de relance formation
- Lecture de la feuille GOUV, détection des collaborateurs à former

### 9.7 Module TRACFIN
- **`LANCEUR_DIAGNOSTIC_360()`** : diagnostic complet du dispositif LCB-FT
- Analyse croisée de toutes les feuilles
- Rapport textuel avec alertes et recommandations

### 9.8 Module PPT
- **`Ouvrir_Presentation_LCB()`** : extraction et ouverture d'un fichier PPTM embarqué
- Données encodées en Base64 dans la feuille DATA_PPTM

### 9.9 ThisWorkbook — Cockpit d'ouverture
- **`Workbook_Open()`** : à chaque ouverture du classeur, analyse complète :
  - Nombre de clients actifs
  - Lignes fantômes (données sans raison sociale)
  - Incohérences de scoring (Simplifié + PPE/Pays/Atypique/Cash)
  - Révisions en retard (selon délai par vigilance : Simplifié=3ans, Standard=2ans, Renforcé=1an)
  - CNI périmées
  - Complétude KYC (SIREN, Mail, IBAN, Adresse manquants)
  - Total honoraires
  - Affichage d'un MsgBox récapitulatif

---

## 10. FONCTIONNALITÉS CRITIQUES À REPRODUIRE

### 10.1 Priorité CRITIQUE (MVP)
1. ✅ Base de données clients (52 colonnes, 30 clients)
2. ✅ Algorithme de scoring multicritère (6 axes + malus)
3. ✅ Calcul automatique du niveau de vigilance
4. ✅ Dashboard KPI (clients actifs, score moyen, répartition vigilance, alertes)
5. ✅ Journal d'audit (LOGS) avec horodatage automatique
6. ✅ Registre des alertes LCB (catégories, statuts, échéances)
7. ✅ Gouvernance (équipe, formations, statuts)

### 10.2 Priorité HAUTE
8. ⬜ Formulaire de saisie client avec validation temps réel
9. ⬜ Recherche API Pappers (SIREN → données société)
10. ⬜ Recherche Sherlock (Google, Maps, Pappers)
11. ⬜ Gestion documentaire (upload KBIS, Statuts, CNI)
12. ⬜ Génération fiche LCB-FT en PDF
13. ⬜ Module de contrôle qualité (échantillonnage aléatoire)
14. ⬜ Détection incohérences scoring (Simplifié + risque)
15. ⬜ Alertes CNI périmées et révisions en retard

### 10.3 Priorité MOYENNE
16. ⬜ Génération lettre de mission (mail merge)
17. ⬜ Relance email formation collaborateurs
18. ⬜ Diagnostic 360° (Tracfin)
19. ⬜ Organigramme du cabinet
20. ⬜ Cockpit d'ouverture (résumé automatique)

---

## 11. RÈGLES MÉTIER SPÉCIFIQUES

### 11.1 Délais de révision par vigilance
- SIMPLIFIEE : tous les 3 ans
- STANDARD : tous les 2 ans  
- RENFORCEE : tous les ans

### 11.2 Forçage de vigilance
Si l'un de ces critères est OUI → vigilance RENFORCEE automatique :
- PPE = OUI
- PAYS RISQUE ≠ "RAS / AUCUN" ou "NON"
- ATYPIQUE = OUI

### 11.3 Seuil critique par axe
Si un seul axe de scoring dépasse SEUIL_CRITIQUE (60) → le score global est forcé au-dessus de SEUIL_HAUT → vigilance RENFORCEE.

### 11.4 Détection ligne fantôme
Si une ligne a des données (col A ou col T non vides) mais pas de Raison Sociale (col E vide) → c'est une ligne fantôme à signaler.

### 11.5 Format des références
Format : `CLI-AA-NNN` où AA = deux derniers chiffres de l'année, NNN = numéro séquentiel sur 3 chiffres.

---

## 12. CHARTE GRAPHIQUE

- **Couleur principale :** Bleu marine / anthracite (#1a1a2e, #16213e, #0f3460)
- **Accent :** Bleu clair (#e94560 pour alertes, #53a8b6 pour info)
- **Vigilance SIMPLIFIEE :** Vert (#4caf50)
- **Vigilance STANDARD :** Orange (#ff9800)  
- **Vigilance RENFORCEE :** Rouge (#f44336)
- **Police :** Sans-serif professionnelle (Inter, Roboto)

---

*Document généré le 06/03/2026 — Version 1.0*
*Source : O90_Tableur_Pilotage_LCBFT.xlsm + CODE_VBA_TABLEUR_O90.pdf (201 pages)*
