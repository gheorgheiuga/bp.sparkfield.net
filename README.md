# Blue Projects Horizon

Horizon Ideas and Horizon Initiatives use Supabase as their shared source of truth. An approved account signs in with an email code. The server checks the account's current approval and role for every data request; database tables and transactional functions are not directly available to anonymous or authenticated Supabase clients. Access relies on the server's existing service-role credential, which must remain private.

## Roles

| Role | Ideas | Initiatives | Settings | Data menu and export |
| --- | --- | --- | --- | --- |
| User | Submit, discuss and support; see idea status | No access | No access | No access |
| Digital Transformation Lead | As above, plus review and pickup | View and edit | View | No access |
| Managing Partner | As above, plus review and pickup | View and edit | View and change | No access |
| Admin | As above, plus manage accounts | View and edit | View and change | Access |

The initiative page and data API are restricted on the server. People who can view information can always copy what they can see; hiding a download button cannot prevent that. Thumbs-ups never automatically prioritize investment. Picking up an idea creates an initiative and changes the idea in one database transaction; it does not approve Gate 0 or investment. The Claude Idea to Business Case artifact remains separate and is not integrated.

## Existing browser data

The old prototype stored data separately in each browser. An administrator can use **Data → Import this browser’s old records** on each browser containing records. The import is explicit and atomic, checks linked ideas and initiatives, and refuses to overwrite existing IDs. Browser-local data is preserved as a backup. Old reactions are reset because they cannot reliably be assigned to an individual; entries labeled “You” are attributed to the account performing the import with an import qualifier. The old browser's settings are not automatically imported; an administrator or managing partner should review the shared defaults.

## Rollout and validation

Apply `supabase/shared.sql` to the connected Supabase project before deploying the updated server and frontend. The migration creates separate private tables, enables row-level security and restricts direct access to the service role; it does not touch the existing access table or browser data. The migration should be reviewed and backed up using the organization's normal database practices. New shared data is not persisted in localStorage. Project saves carry a revision; competing changes are rejected rather than silently overwritten, and unsaved changes remain only in the open page until resolved.

`node data-test.cjs`, `node auth-test.cjs` and `node middleware-test.cjs` cover the permission boundary and basic conflict behavior with mocked services. Transactional handoff and import were separately tested against Supabase within rolled-back transactions. A deployed end-to-end test with the actual roles remains necessary after deployment. User content and financial assumptions are not audit-grade, and no file attachments, notifications, formal audit trail or enterprise SSO are implemented.

The exact Gmail address remains a temporary login exception as a standard user, while the designated company email is the primary administrator. The user-management interface controls approvals and roles. The temporary Gmail exception can be removed after testing is complete.
