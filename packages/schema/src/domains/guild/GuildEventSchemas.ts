// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	MAX_GUILD_EVENT_DESCRIPTION_LENGTH,
	MAX_GUILD_EVENT_LOCATION_LENGTH,
	MAX_GUILD_EVENT_NAME_LENGTH,
} from '@fluxer/constants/src/LimitConstants';
import {SnowflakeStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const GuildEventStatuses = {
	SCHEDULED: 1,
	ACTIVE: 2,
	COMPLETED: 3,
	CANCELED: 4,
} as const;

export type GuildEventStatus = (typeof GuildEventStatuses)[keyof typeof GuildEventStatuses];

const GuildEventStatusType = z
	.union([
		z.literal(GuildEventStatuses.SCHEDULED),
		z.literal(GuildEventStatuses.ACTIVE),
		z.literal(GuildEventStatuses.COMPLETED),
		z.literal(GuildEventStatuses.CANCELED),
	])
	.describe('The status of the guild scheduled event');

export const GuildEventCreateRequest = z
	.object({
		name: z.string().min(1).max(MAX_GUILD_EVENT_NAME_LENGTH).describe('The name of the scheduled event'),
		description: z
			.string()
			.max(MAX_GUILD_EVENT_DESCRIPTION_LENGTH)
			.nullish()
			.describe('The description of the scheduled event'),
		scheduled_start_time: z.iso.datetime().describe('ISO8601 timestamp of when the event is scheduled to start'),
		scheduled_end_time: z.iso.datetime().nullish().describe('ISO8601 timestamp of when the event is scheduled to end'),
		channel_id: SnowflakeStringType.nullish().describe('The channel the event is associated with, if any'),
		location: z
			.string()
			.max(MAX_GUILD_EVENT_LOCATION_LENGTH)
			.nullish()
			.describe('The external location of the event, if it is not hosted in a channel'),
	})
	.strict();

export type GuildEventCreateRequest = z.infer<typeof GuildEventCreateRequest>;

export const GuildEventUpdateRequest = z
	.object({
		name: z.string().min(1).max(MAX_GUILD_EVENT_NAME_LENGTH).nullish(),
		description: z.string().max(MAX_GUILD_EVENT_DESCRIPTION_LENGTH).nullish(),
		scheduled_start_time: z.iso.datetime().nullish(),
		scheduled_end_time: z.iso.datetime().nullish(),
		channel_id: SnowflakeStringType.nullish(),
		location: z.string().max(MAX_GUILD_EVENT_LOCATION_LENGTH).nullish(),
		status: GuildEventStatusType.nullish(),
	})
	.strict();

export type GuildEventUpdateRequest = z.infer<typeof GuildEventUpdateRequest>;

export const GuildEventResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this scheduled event'),
	guild_id: SnowflakeStringType.describe('The guild this event belongs to'),
	channel_id: SnowflakeStringType.nullish().describe('The channel this event is associated with, if any'),
	creator_id: SnowflakeStringType.describe('The user who created this event'),
	name: z.string().describe('The name of the event'),
	description: z.string().nullish().describe('The description of the event'),
	scheduled_start_time: z.iso.datetime().describe('ISO8601 timestamp of when the event starts'),
	scheduled_end_time: z.iso.datetime().nullish().describe('ISO8601 timestamp of when the event ends'),
	status: GuildEventStatusType,
	location: z.string().nullish().describe('The external location of the event, if any'),
	created_at: z.iso.datetime().describe('ISO8601 timestamp of when the event was created'),
	updated_at: z.iso.datetime().describe('ISO8601 timestamp of when the event was last updated'),
});

export type GuildEventResponse = z.infer<typeof GuildEventResponse>;

export const GuildEventListResponse = z.array(GuildEventResponse);

export type GuildEventListResponse = z.infer<typeof GuildEventListResponse>;
