// SPDX-License-Identifier: AGPL-3.0-or-later

import {addMemberRole, createRole, setupTestGuildWithMembers} from '@app/api/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {GuildEventCreateRequest, GuildEventResponse} from '@fluxer/schema/src/domains/guild/GuildEventSchemas';
import {GuildEventStatuses} from '@fluxer/schema/src/domains/guild/GuildEventSchemas';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

function startTime(offsetMinutes = 60): string {
	return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

describe('Guild Scheduled Events', () => {
	let harness: ApiTestHarness;
	beforeEach(async () => {
		harness = await createApiTestHarness();
	});
	afterEach(async () => {
		await harness?.shutdown();
	});
	async function createEvent(
		token: string,
		guildId: string,
		body: Partial<GuildEventCreateRequest> = {},
	): Promise<GuildEventResponse> {
		return createBuilder<GuildEventResponse>(harness, token)
			.post(`/guilds/${guildId}/events`)
			.body({name: 'Weekly sync', scheduled_start_time: startTime(), ...body})
			.expect(HTTP_STATUS.OK)
			.execute();
	}
	async function listEvents(token: string, guildId: string): Promise<Array<GuildEventResponse>> {
		return createBuilder<Array<GuildEventResponse>>(harness, token)
			.get(`/guilds/${guildId}/events`)
			.expect(HTTP_STATUS.OK)
			.execute();
	}

	test('creates, lists, updates and deletes a scheduled event', async () => {
		const {owner, guild} = await setupTestGuildWithMembers(harness, 1);
		const created = await createEvent(owner.token, guild.id, {
			description: 'Planning session',
			location: 'Meeting room 2',
		});
		expect(created.guild_id).toBe(guild.id);
		expect(created.creator_id).toBe(owner.userId);
		expect(created.name).toBe('Weekly sync');
		expect(created.description).toBe('Planning session');
		expect(created.location).toBe('Meeting room 2');
		expect(created.status).toBe(GuildEventStatuses.SCHEDULED);
		expect(created.channel_id).toBeNull();

		const listed = await listEvents(owner.token, guild.id);
		expect(listed).toHaveLength(1);
		expect(listed[0]?.id).toBe(created.id);

		const updated = await createBuilder<GuildEventResponse>(harness, owner.token)
			.patch(`/guilds/${guild.id}/events/${created.id}`)
			.body({name: 'Renamed sync', status: GuildEventStatuses.CANCELED})
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(updated.name).toBe('Renamed sync');
		expect(updated.status).toBe(GuildEventStatuses.CANCELED);
		expect(updated.description).toBe('Planning session');

		await createBuilder(harness, owner.token)
			.delete(`/guilds/${guild.id}/events/${created.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
		expect(await listEvents(owner.token, guild.id)).toHaveLength(0);
	});

	test('rejects an event that ends before it starts', async () => {
		const {owner, guild} = await setupTestGuildWithMembers(harness, 1);
		const response = await createBuilder<{code: string}>(harness, owner.token)
			.post(`/guilds/${guild.id}/events`)
			.body({
				name: 'Backwards event',
				scheduled_start_time: startTime(120),
				scheduled_end_time: startTime(60),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
		expect(response.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
	});

	test('requires the manage_guild permission to mutate events', async () => {
		const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0];
		await createBuilder<{code: string}>(harness, member.token)
			.post(`/guilds/${guild.id}/events`)
			.body({name: 'Unauthorized event', scheduled_start_time: startTime()})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
		const managerRole = await createRole(harness, owner.token, guild.id, {
			name: 'Event Manager',
			permissions: Permissions.MANAGE_GUILD.toString(),
		});
		await addMemberRole(harness, owner.token, guild.id, member.userId, managerRole.id);
		const created = await createEvent(member.token, guild.id);
		expect(created.creator_id).toBe(member.userId);
	});

	test('returns 404 for an unknown event', async () => {
		const {owner, guild} = await setupTestGuildWithMembers(harness, 1);
		const response = await createBuilder<{code: string}>(harness, owner.token)
			.patch(`/guilds/${guild.id}/events/1`)
			.body({name: 'Ghost event'})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
		expect(response.code).toBe(APIErrorCodes.UNKNOWN_GUILD_EVENT);
	});
});
