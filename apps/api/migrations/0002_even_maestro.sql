CREATE TABLE `daily_track_grant` (
	`userId` text NOT NULL,
	`dateUTC` text NOT NULL,
	`trackId` text NOT NULL,
	`createdAt` integer NOT NULL,
	PRIMARY KEY(`userId`, `dateUTC`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_track_grant_userId_idx` ON `daily_track_grant` (`userId`);--> statement-breakpoint
CREATE INDEX `daily_track_grant_dateUTC_idx` ON `daily_track_grant` (`dateUTC`);--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'user' NOT NULL;