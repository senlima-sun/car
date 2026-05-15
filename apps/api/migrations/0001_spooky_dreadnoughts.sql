CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `account_provider_account_idx` ON `account` (`providerId`,`accountId`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);