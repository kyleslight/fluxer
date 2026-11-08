// SPDX-License-Identifier: AGPL-3.0-or-later

import {type ChannelID, createChannelID, createGuildEventID, type GuildID} from '@app/api/BrandedTypes';
import {mapGuildEventToResponse} from '@app/api/guild/GuildModel';
import type {GuildEventRepository} from '@app/api/guild/repositories/GuildEventRepository';
import type {IGatewayService} from '@app/api/infrastructure/IGatewayService';
import type {ISnowflakeService} from '@app/api/infrastructure/ISnowflakeService';
import type {GuildEvent} from '@app/api/models/GuildEvent';
import type {User} from '@app/api/models/User';
import {requirePermission} from '@app/api/utils/PermissionUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {MAX_GUILD_EVENTS} from '@fluxer/constants/src/LimitConstants';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {MaxGuildEventsError} from '@fluxer/errors/src/domains/guild/MaxGuildEventsError';
import {UnknownGuildEventError} from '@fluxer/errors/src/domains/guild/UnknownGuildEventError';
import type {
	GuildEventCreateRequest,
	GuildEventResponse,
	GuildEventUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildEventSchemas';
import {GuildEventStatuses} from '@fluxer/schema/src/domains/guild/GuildEventSchemas';

export class GuildEventService {
	constructor(
		private readonly guildEventRepository: GuildEventRepository,
		private readonly gatewayService: IGatewayService,
		private readonly snowflakeService: ISnowflakeService,
	) {}

	async listEvents(params: {userId: User['id']; guildId: GuildID}): Promise<Array<GuildEventResponse>> {
		const {userId, guildId} = params;
		await this.gatewayService.getGuildData({userId, guildId});
		const events = await this.guildEventRepository.listByGuild(guildId);
		return events.map(mapGuildEventToResponse);
	}

	async createEvent(params: {
		user: User;
		guildId: GuildID;
		body: GuildEventCreateRequest;
	}): Promise<GuildEventResponse> {
		const {user, guildId, body} = params;
		await requirePermission(this.gatewayService, {
			guildId,
			userId: user.id,
			permission: Permissions.MANAGE_GUILD,
		});
		const startTime = new Date(body.scheduled_start_time);
		const endTime = body.scheduled_end_time ? new Date(body.scheduled_end_time) : null;
		this.validateTimes(startTime, endTime);
		const existing = await this.guildEventRepository.listByGuild(guildId);
		if (existing.length >= MAX_GUILD_EVENTS) {
			throw new MaxGuildEventsError(MAX_GUILD_EVENTS);
		}
		const now = new Date();
		const eventId = createGuildEventID(await this.snowflakeService.generate());
		const event = await this.guildEventRepository.upsert({
			event_id: eventId,
			guild_id: guildId,
			channel_id: body.channel_id ? createChannelID(BigInt(body.channel_id)) : null,
			creator_id: user.id,
			name: body.name,
			description: body.description ?? null,
			scheduled_start_time: startTime,
			scheduled_end_time: endTime,
			status: GuildEventStatuses.SCHEDULED,
			location: body.location ?? null,
			created_at: now,
			updated_at: now,
			version: 1,
		});
		await this.dispatchEvent(event);
		return mapGuildEventToResponse(event);
	}

	async updateEvent(params: {
		user: User;
		guildId: GuildID;
		eventId: string;
		body: GuildEventUpdateRequest;
	}): Promise<GuildEventResponse> {
		const {user, guildId, eventId, body} = params;
		await requirePermission(this.gatewayService, {
			guildId,
			userId: user.id,
			permission: Permissions.MANAGE_GUILD,
		});
		const event = await this.requireEvent(guildId, eventId);
		const startTime = body.scheduled_start_time ? new Date(body.scheduled_start_time) : event.scheduledStartTime;
		let endTime: Date | null;
		if (body.scheduled_end_time === undefined) {
			endTime = event.scheduledEndTime;
		} else if (body.scheduled_end_time === null) {
			endTime = null;
		} else {
			endTime = new Date(body.scheduled_end_time);
		}
		this.validateTimes(startTime, endTime);
		let channelId: ChannelID | null = event.channelId;
		if (body.channel_id !== undefined) {
			channelId = body.channel_id === null ? null : createChannelID(BigInt(body.channel_id));
		}
		const updated = await this.guildEventRepository.upsert({
			...event.toRow(),
			channel_id: channelId,
			name: body.name ?? event.name,
			description: body.description === undefined ? event.description : body.description,
			scheduled_start_time: startTime,
			scheduled_end_time: endTime,
			status: body.status ?? event.status,
			location: body.location === undefined ? event.location : body.location,
			updated_at: new Date(),
			version: event.version + 1,
		});
		await this.dispatchEvent(updated);
		return mapGuildEventToResponse(updated);
	}

	async deleteEvent(params: {user: User; guildId: GuildID; eventId: string}): Promise<void> {
		const {user, guildId, eventId} = params;
		await requirePermission(this.gatewayService, {
			guildId,
			userId: user.id,
			permission: Permissions.MANAGE_GUILD,
		});
		const event = await this.requireEvent(guildId, eventId);
		await this.guildEventRepository.delete(guildId, event.id);
		await this.gatewayService.dispatchGuild({
			guildId,
			event: 'GUILD_EVENT_DELETE',
			data: {guild_id: guildId.toString(), event_id: event.id.toString()},
		});
	}

	private async requireEvent(guildId: GuildID, eventId: string): Promise<GuildEvent> {
		const event = await this.guildEventRepository.findById(createGuildEventID(BigInt(eventId)));
		if (!event || event.guildId !== guildId) {
			throw new UnknownGuildEventError();
		}
		return event;
	}

	private validateTimes(startTime: Date, endTime: Date | null): void {
		if (!Number.isFinite(startTime.getTime())) {
			throw InputValidationError.fromCode('scheduled_start_time', 'INVALID_ISO_TIMESTAMP');
		}
		if (endTime && endTime.getTime() <= startTime.getTime()) {
			throw InputValidationError.fromCode('scheduled_end_time', 'SCHEDULED_END_BEFORE_START');
		}
	}

	private async dispatchEvent(event: GuildEvent): Promise<void> {
		await this.gatewayService.dispatchGuild({
			guildId: event.guildId,
			event: 'GUILD_EVENT_UPDATE',
			data: {guild_id: event.guildId.toString(), event: mapGuildEventToResponse(event)},
		});
	}
}
