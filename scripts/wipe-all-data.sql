-- Wipe all user-related data (profiles cascade deletes sessions, orders,
-- disputes, notifications, refunds, wallets, wallet_transactions, bank_accounts,
-- and their children). merchants cascade their children too. The remaining
-- tables (user_roles, kyc_records, support_tickets) have no FK to profiles.
TRUNCATE TABLE
  public.profiles,
  public.merchants,
  public.user_roles,
  public.kyc_records,
  public.support_tickets
CASCADE;
