const { z } = require('zod');

/** Schema for creating a new inventory location. */
const createLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(200),
  code: z.string().min(1, 'Location code is required').max(50),
  description: z.string().max(1000).optional().nullable(),
});

/** Schema for updating a location — all fields optional. */
const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().max(1000).optional().nullable(),
});

/** Schema for query params on GET /locations. */
const listLocationsQuery = z.object({
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

module.exports = {
  createLocationSchema,
  updateLocationSchema,
  listLocationsQuery,
};
