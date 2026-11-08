-- Restrict direct public-role access; the server uses its existing trusted DB role.
ALTER TABLE public."sfa_teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sfa_team_members" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."sfa_teams", public."sfa_team_members" FROM PUBLIC, anon, authenticated;
