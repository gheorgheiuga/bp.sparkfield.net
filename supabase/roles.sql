-- Apply once before deploying the role-aware access service.
-- Existing approval statuses are retained. The primary company administrator
-- is backfilled; every other existing account starts with the User role.
ALTER TABLE public.horizon_access ADD COLUMN role text NOT NULL DEFAULT 'user';
ALTER TABLE public.horizon_access ADD CONSTRAINT horizon_access_role_check CHECK (role IN ('admin','user','dt_lead','managing_partner'));
UPDATE public.horizon_access SET role='admin' WHERE lower(email)='gheorghe.iuga@blueprojects.com';
