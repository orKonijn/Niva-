CREATE UNIQUE INDEX IF NOT EXISTS niva_provider_account_unique ON account(providerId, accountId);
CREATE INDEX IF NOT EXISTS niva_account_owner ON account(userId);
CREATE INDEX IF NOT EXISTS niva_session_owner ON session(userId);
CREATE INDEX IF NOT EXISTS niva_verification_identifier ON verification(identifier);
