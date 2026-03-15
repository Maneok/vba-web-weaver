/**
 * Service CRUD pour les referentiels (missions, pays, types juridiques, activites, questions).
 * Utilise le localStorage comme backend en attendant une table Supabase dediee.
 */

/* ---------- types ---------- */

export type NiveauRisque = "Faible" | "Moyen" | "Élevé";

export interface RefMission {
  id: string;
  libelle: string;
  type: string;
  description: string;
  niveau_risque: NiveauRisque;
  parametres_pilotes: boolean;
}

export interface RefPays {
  id: string;
  code: string;
  libelle: string;
  libelle_nationalite: string;
  description: string;
  niveau_risque: NiveauRisque;
  parametres_pilotes: boolean;
}

export interface RefTypeJuridique {
  id: string;
  code: string;
  libelle: string;
  type_client: string;
  description: string;
  niveau_risque: NiveauRisque;
  parametres_pilotes: boolean;
}

export interface RefActivite {
  id: string;
  code: string;
  libelle: string;
  description: string;
  niveau_risque: NiveauRisque;
  parametres_pilotes: boolean;
}

export interface RefQuestion {
  id: string;
  libelle: string;
  categories: string[];
  description: string;
  reponse_risquee: string;
  parametres_pilotes: boolean;
}

/* ---------- helpers ---------- */

function generateId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function loadStore<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStore<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

/* ---------- generic CRUD factory ---------- */

function createService<T extends { id: string }>(storageKey: string) {
  return {
    getAll(): T[] {
      return loadStore<T>(storageKey);
    },

    getById(id: string): T | undefined {
      return loadStore<T>(storageKey).find((item) => item.id === id);
    },

    create(item: Omit<T, "id">): T {
      const items = loadStore<T>(storageKey);
      const newItem = { ...item, id: generateId() } as T;
      items.push(newItem);
      saveStore(storageKey, items);
      return newItem;
    },

    update(id: string, updates: Partial<T>): T | undefined {
      const items = loadStore<T>(storageKey);
      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) return undefined;
      items[idx] = { ...items[idx], ...updates, id };
      saveStore(storageKey, items);
      return items[idx];
    },

    delete(id: string): boolean {
      const items = loadStore<T>(storageKey);
      const filtered = items.filter((item) => item.id !== id);
      if (filtered.length === items.length) return false;
      saveStore(storageKey, filtered);
      return true;
    },
  };
}

/* ---------- service instances ---------- */

export const missionsService = createService<RefMission>("grimy_ref_missions");
export const paysService = createService<RefPays>("grimy_ref_pays");
export const typesJuridiquesService = createService<RefTypeJuridique>("grimy_ref_types_juridiques");
export const activitesService = createService<RefActivite>("grimy_ref_activites");
export const questionsService = createService<RefQuestion>("grimy_ref_questions");
