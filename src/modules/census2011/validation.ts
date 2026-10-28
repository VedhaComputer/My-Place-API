import { z } from 'zod';
import { PLACE_LEVELS } from '../../shared/constants';

export const census2011QuerySchema = z.object({
  parentId: z.string().optional(),
  level: z.enum([
    PLACE_LEVELS.COUNTRY,
    PLACE_LEVELS.STATE_UT,
    PLACE_LEVELS.DISTRICT,
    PLACE_LEVELS.TEHSIL,
    PLACE_LEVELS.CITY_TOWN,
    PLACE_LEVELS.VILLAGE,
  ]).optional(),
  censusCode: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 1 && Number.isInteger(Number(val))), {
    message: 'page must be a positive integer',
  }),
  limit: z.string().optional().refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 100 && Number.isInteger(Number(val))), {
    message: 'limit must be an integer between 1 and 100',
  }),
});
