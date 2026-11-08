// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {BadRequestError} from '@fluxer/errors/src/domains/core/BadRequestError';

export class MaxGuildEventsError extends BadRequestError {
	constructor(maxEvents: number) {
		super({
			code: APIErrorCodes.MAX_GUILD_EVENTS,
			messageVariables: {count: maxEvents},
		});
	}
}
