// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ChannelID, GuildEventID, GuildID, UserID} from '@app/api/BrandedTypes';
import type {GuildEventRow} from '@app/api/database/types/GuildTypes';
import {GuildEventStatuses} from '@fluxer/schema/src/domains/guild/GuildEventSchemas';

export class GuildEvent {
	readonly id: GuildEventID;
	readonly guildId: GuildID;
	readonly channelId: ChannelID | null;
	readonly creatorId: UserID;
	readonly name: string;
	readonly description: string | null;
	readonly scheduledStartTime: Date;
	readonly scheduledEndTime: Date | null;
	readonly status: number;
	readonly location: string | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly version: number;

	constructor(row: GuildEventRow) {
		this.id = row.event_id;
		this.guildId = row.guild_id;
		this.channelId = row.channel_id;
		this.creatorId = row.creator_id;
		this.name = row.name;
		this.description = row.description;
		this.scheduledStartTime = row.scheduled_start_time;
		this.scheduledEndTime = row.scheduled_end_time;
		this.status = row.status;
		this.location = row.location;
		this.createdAt = row.created_at;
		this.updatedAt = row.updated_at;
		this.version = row.version;
	}

	isCanceled(): boolean {
		return this.status === GuildEventStatuses.CANCELED;
	}

	toRow(): GuildEventRow {
		return {
			event_id: this.id,
			guild_id: this.guildId,
			channel_id: this.channelId,
			creator_id: this.creatorId,
			name: this.name,
			description: this.description,
			scheduled_start_time: this.scheduledStartTime,
			scheduled_end_time: this.scheduledEndTime,
			status: this.status,
			location: this.location,
			created_at: this.createdAt,
			updated_at: this.updatedAt,
			version: this.version,
		};
	}
}
