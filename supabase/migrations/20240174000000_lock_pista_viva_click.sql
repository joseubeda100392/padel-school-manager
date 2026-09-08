-- Cierre menor del barrido: increment_pista_viva_click también era
-- invocable sin login (riesgo bajo, solo infla un contador de clics de
-- marketing, sin datos ni dinero de por medio) — pero ya se llama siempre
-- desde app/pv/[campaignId]/route.ts con la service role, nunca hace falta
-- que sea pública. Se cierra por consistencia con el resto.
REVOKE EXECUTE ON FUNCTION increment_pista_viva_click(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_pista_viva_click(uuid) TO service_role;
