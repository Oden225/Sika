// Données de référence adaptées à la Côte d'Ivoire : catégories, modèles de
// factures et opérateurs Mobile Money.

export const CATEGORIES = [
  // Revenus
  { id: "salaire", type: "income", label: "Salaire", icon: "💼", color: "#16a34a" },
  { id: "commerce", type: "income", label: "Commerce / activité", icon: "🛍️", color: "#0d9488" },
  { id: "petits_boulots", type: "income", label: "Petits boulots", icon: "🛠️", color: "#0891b2" },
  { id: "transfert_recu", type: "income", label: "Transfert reçu", icon: "📲", color: "#2563eb" },
  { id: "tontine_recue", type: "income", label: "Tontine reçue", icon: "🤝", color: "#ea580c" },
  { id: "remboursement_recu", type: "income", label: "Remboursement reçu", icon: "↩️", color: "#7c3aed" },
  { id: "emprunt_recu", type: "income", label: "Argent emprunté", icon: "🏦", color: "#64748b" },
  { id: "autre_revenu", type: "income", label: "Autre revenu", icon: "➕", color: "#475569" },
  // Dépenses
  { id: "loyer", type: "expense", label: "Loyer", icon: "🏠", color: "#4f46e5" },
  { id: "electricite", type: "expense", label: "Électricité (CIE)", icon: "⚡", color: "#f59e0b", group: "factures" },
  { id: "eau", type: "expense", label: "Eau (SODECI)", icon: "💧", color: "#0ea5e9", group: "factures" },
  { id: "tv_internet", type: "expense", label: "TV / Internet", icon: "📺", color: "#6366f1", group: "factures" },
  { id: "credit_data", type: "expense", label: "Crédit & data", icon: "📱", color: "#8b5cf6", group: "factures" },
  { id: "alimentation", type: "expense", label: "Marché / alimentation", icon: "🛒", color: "#22c55e" },
  { id: "transport", type: "expense", label: "Transport (gbaka, woro-woro…)", icon: "🚕", color: "#eab308" },
  { id: "sante", type: "expense", label: "Santé / pharmacie", icon: "💊", color: "#ef4444" },
  { id: "scolarite", type: "expense", label: "Scolarité", icon: "🎓", color: "#3b82f6" },
  { id: "famille", type: "expense", label: "Famille / village", icon: "👨‍👩‍👧", color: "#db2777", group: "soutien" },
  { id: "ceremonies", type: "expense", label: "Cérémonies (funérailles, mariages…)", icon: "🕊️", color: "#be185d", group: "soutien" },
  { id: "tontine", type: "expense", label: "Cotisation tontine", icon: "🤝", color: "#f97316" },
  { id: "frais_momo", type: "expense", label: "Frais Mobile Money", icon: "💸", color: "#dc2626" },
  { id: "habillement", type: "expense", label: "Habillement", icon: "👕", color: "#a855f7" },
  { id: "loisirs", type: "expense", label: "Sorties / loisirs", icon: "🎉", color: "#ec4899" },
  { id: "epargne", type: "expense", label: "Épargne", icon: "🐷", color: "#14b8a6" },
  { id: "pret_accorde", type: "expense", label: "Prêt accordé", icon: "🫴", color: "#7c3aed" },
  { id: "remboursement_dette", type: "expense", label: "Remboursement de dette", icon: "🧾", color: "#64748b" },
  { id: "autre_depense", type: "expense", label: "Autre dépense", icon: "▫️", color: "#94a3b8" },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const categoriesOf = (type) => CATEGORIES.filter((c) => c.type === type);
export const category = (id) => CATEGORY_BY_ID[id] || CATEGORY_BY_ID.autre_depense;

/** Correspondance des libellés de la première version vers les nouveaux identifiants. */
export const LEGACY_CATEGORY = {
  Salaire: "salaire",
  "Activité secondaire": "commerce",
  Cadeau: "autre_revenu",
  "Autre revenu": "autre_revenu",
  Logement: "loyer",
  Alimentation: "alimentation",
  Transport: "transport",
  Santé: "sante",
  Éducation: "scolarite",
  Communication: "credit_data",
  Loisirs: "loisirs",
  Famille: "famille",
  Épargne: "epargne",
  "Autre dépense": "autre_depense",
};

export const FREQUENCIES = {
  weekly: { label: "Chaque semaine", short: "Hebdo", unit: "semaine" },
  monthly: { label: "Chaque mois", short: "Mensuel", unit: "mois" },
  bimonthly: { label: "Tous les 2 mois", short: "Bimestriel", unit: "2 mois" },
  quarterly: { label: "Chaque trimestre", short: "Trimestriel", unit: "trimestre" },
  yearly: { label: "Chaque année", short: "Annuel", unit: "an" },
};

/**
 * Modèles pour programmer en un geste les paiements courants.
 * `day: 31` = fin du mois (ramené au dernier jour des mois courts).
 */
export const BILL_TEMPLATES = [
  { type: "income", category: "salaire", note: "Salaire", day: 31, frequency: "monthly" },
  { type: "expense", category: "loyer", note: "Loyer", day: 5, frequency: "monthly" },
  { type: "expense", category: "electricite", note: "Facture CIE", day: 15, frequency: "monthly", variable: true },
  { type: "expense", category: "eau", note: "Facture SODECI", day: 15, frequency: "monthly", variable: true },
  { type: "expense", category: "tv_internet", note: "Abonnement Canal+", day: 1, frequency: "monthly" },
  { type: "expense", category: "tv_internet", note: "Internet / fibre", day: 1, frequency: "monthly" },
  { type: "expense", category: "credit_data", note: "Forfait crédit & data", day: 1, frequency: "monthly" },
  { type: "expense", category: "scolarite", note: "Scolarité", day: 5, frequency: "quarterly" },
];

/**
 * Opérateurs Mobile Money et frais par défaut (en % du montant, avec plafond
 * éventuel en FCFA). Valeurs indicatives : les grilles changent souvent, elles
 * sont modifiables dans les réglages et à chaque opération.
 */
export const OPERATORS = {
  wave: { label: "Wave", color: "#1dc8ff", fees: { send: { rate: 1, cap: 0 }, withdraw: { rate: 0, cap: 0 } } },
  orange: { label: "Orange Money", color: "#ff7900", fees: { send: { rate: 1, cap: 0 }, withdraw: { rate: 1, cap: 0 } } },
  mtn: { label: "MTN MoMo", color: "#ffcc00", fees: { send: { rate: 1, cap: 4500 }, withdraw: { rate: 0, cap: 0 } } },
  moov: { label: "Moov Money", color: "#0066b3", fees: { send: { rate: 1, cap: 0 }, withdraw: { rate: 1, cap: 0 } } },
};

export const PAYMENT_METHODS = {
  cash: "Espèces",
  wave: "Wave",
  orange: "Orange Money",
  mtn: "MTN MoMo",
  moov: "Moov Money",
  bank: "Banque",
};
