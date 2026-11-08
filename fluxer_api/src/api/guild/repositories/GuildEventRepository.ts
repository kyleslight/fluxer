// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildEventID, GuildID} from '@app/api/BrandedTypes';
import {BatchBuilder, fetchMany, fetchOne} from '@app/api/database/CassandraQueryExecution';
import type {GuildEventByGuildRow, GuildEventRow} from '@app/api/database/types/GuildTypes';
import {GuildEvent} from '@app/api/models/GuildEvent';
import {GuildEvents, GuildEventsByGuild} from '@app/api/Tables';

const FETCH_GUILD_EVENT_BY_ID_CQL = GuildEvents.selectCql({
	where: GuildEvents.where.eq('event_id'),
	limit: 1,
});
const FETCH_GUILD_EVENTS_BY_GUILD_CQL = GuildEventsByGuild.selectCql({
	columns: ['event_id'],
	where: GuildEventsByGuild.where.eq('guild_id'),
});

export class GuildEventRepository {
	async findById(eventId: GuildEventID): Promise<GuildEvent | null> {
		const row = await fetchOne<GuildEventRow>(FETCH_GUILD_EVENT_BY_ID_CQL, {event_id: eventId});
		return row ? new GuildEvent(row) : null;
	}

	async listByGuild(guildId: GuildID): Promise<Array<GuildEvent>> {
		const rows = await fetchMany<{
			event_id: GuildEventID;
		}>(FETCH_GUILD_EVENTS_BY_GUILD_CQL, {guild_id: guildId});
		if (rows.length === 0) return [];
		const events: Array<GuildEvent> = [];
		for (const {event_id} of rows) {
			const event = await this.findById(event_id);
			if (event) events.push(event);
		}
		return events.sort((a, b) => a.scheduledStartTime.getTime() - b.scheduledStartTime.getTime());
	}

	async upsert(data: GuildEventRow): Promise<GuildEvent> {
		const indexRow: GuildEventByGuildRow = {
			guild_id: data.guild_id,
			event_id: data.event_id,
			scheduled_start_time: data.scheduled_start_time,
		};
		const batch = new BatchBuilder();
		batch.addPrepared(GuildEvents.insert(data));
		batch.addPrepared(GuildEventsByGuild.insert(indexRow));
		await batch.execute();
		return new GuildEvent(data);
	}

	async delete(guildId: GuildID, eventId: GuildEventID): Promise<void> {
		const batch = new BatchBuilder();
		batch.addPrepared(GuildEvents.deleteByPk({event_id: eventId}));
		batch.addPrepared(GuildEventsByGuild.deleteByPk({guild_id: guildId, event_id: eventId}));
		await batch.execute();
	}
}
