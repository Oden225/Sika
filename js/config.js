// Connexion au compte en ligne (Supabase). Laisser vide pour utiliser Sika
// uniquement sur le téléphone. Voir README.md, section « Compte en ligne ».
// La clé « anon » est publique par conception : la sécurité repose sur les
// règles d'accès (RLS) définies dans supabase/schema.sql.
export const SUPABASE_URL = "https://zrucvwovidsonryvjvuz.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydWN2d292aWRzb25yeXZqdnV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4ODc4NTgsImV4cCI6MjEwNzQ2Mzg1OH0.vs1Kq7JZCPwqSTArLrxrCpe0O0zADXPNlYzjxYrcZnQ";

// Nombre de chiffres du code reçu par e-mail : doit correspondre au réglage
// Supabase « Email OTP Length » (Authentication → Sign In / Providers → Email).
export const OTP_LENGTH = 6;
