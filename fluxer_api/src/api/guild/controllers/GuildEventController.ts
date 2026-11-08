// SPDX-License-Identifier: AGPL-3.0-or-later

import {createGuildID} from '@app/api/BrandedTypes';
import {LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {Validator} from '@app/api/Validator';
import {GuildIdGuildEventIdParam, GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	GuildEventCreateRequest,
	GuildEventListResponse,
	GuildEventResponse,
	GuildEventUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildEventSchemas';

export function GuildEventController(app: HonoApp) {
	app.get(
		'/guilds/:guild_id/events',
		RateLimitMiddleware(RateLimitConfigs.GUILD_EVENT_LIST),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_guild_events',
			summary: 'List guild scheduled events',
			responseSchema: GuildEventListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description: 'List the scheduled events of a guild the user is a member of, ordered by start time.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const events = await ctx.get('guildService').events.listEvents({userId: user.id, guildId});
			return ctx.json(events);
		},
	);
	app.post(
		'/guilds/:guild_id/events',
		RateLimitMiddleware(RateLimitConfigs.GUILD_EVENT_CREATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', GuildEventCreateRequest),
		OpenAPI({
			operationId: 'create_guild_event',
			summary: 'Create guild scheduled event',
			responseSchema: GuildEventResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description: 'Create a scheduled event in a guild. Requires the manage_guild permission.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const body = ctx.req.valid('json');
			const event = await ctx.get('guildService').events.createEvent({user, guildId, body});
			return ctx.json(event);
		},
	);
	app.patch(
		'/guilds/:guild_id/events/:event_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_EVENT_UPDATE),
		LoginRequired,
		Validator('param', GuildIdGuildEventIdParam),
		Validator('json', GuildEventUpdateRequest),
		OpenAPI({
			operationId: 'update_guild_event',
			summary: 'Update guild scheduled event',
			responseSchema: GuildEventResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description: 'Update a scheduled event in a guild. Requires the manage_guild permission.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const params = ctx.req.valid('param');
			const guildId = createGuildID(params.guild_id);
			const body = ctx.req.valid('json');
			const event = await ctx
				.get('guildService')
				.events.updateEvent({user, guildId, eventId: params.event_id.toString(), body});
			return ctx.json(event);
		},
	);
	app.delete(
		'/guilds/:guild_id/events/:event_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_EVENT_DELETE),
		LoginRequired,
		Validator('param', GuildIdGuildEventIdParam),
		OpenAPI({
			operationId: 'delete_guild_event',
			summary: 'Delete guild scheduled event',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description: 'Delete a scheduled event from a guild. Requires the manage_guild permission.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const params = ctx.req.valid('param');
			const guildId = createGuildID(params.guild_id);
			await ctx.get('guildService').events.deleteEvent({
				user,
				guildId,
				eventId: params.event_id.toString(),
			});
			return ctx.body(null, 204);
		},
	);
}
