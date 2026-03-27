const { prisma } = require('../db');
const { notFoundError } = require('../utils/errors');

/** List all locations for a tenant (no pagination — locations are few). */
const list = async (tenantId, query) => {
  const { search, isActive } = query;

  const where = { tenantId };

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }

  return prisma.inventoryLocation.findMany({
    where,
    orderBy: { name: 'asc' },
  });
};

/** Get a single location by ID within tenant scope. */
const getById = async (id, tenantId) => {
  const location = await prisma.inventoryLocation.findFirst({
    where: { id, tenantId },
  });

  if (!location) {
    throw notFoundError('Location not found');
  }

  return location;
};

/** Create a new inventory location. */
const create = async (data, tenantId) => {
  return prisma.inventoryLocation.create({
    data: { ...data, tenantId },
  });
};

/** Update an existing location within tenant scope. */
const update = async (id, data, tenantId) => {
  await getById(id, tenantId);

  return prisma.inventoryLocation.update({
    where: { id },
    data,
  });
};

/** Soft-deactivate a location. Spec says: 400 if location has stock. */
const deactivate = async (id, tenantId) => {
  await getById(id, tenantId);

  // Check if location has any inventory stock
  const stockCount = await prisma.inventoryStock.count({
    where: { locationId: id, quantityOnHand: { gt: 0 } },
  });

  if (stockCount > 0) {
    const { AppError } = require('../utils/errors');
    throw new AppError(400, 'REFERENCE_CONFLICT', 'Cannot deactivate location with existing stock');
  }

  return prisma.inventoryLocation.update({
    where: { id },
    data: { isActive: false },
  });
};

module.exports = { list, getById, create, update, deactivate };
