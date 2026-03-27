const { prisma } = require('../db');
const { notFoundError } = require('../utils/errors');

// ============================================
// LIST — paginated, filterable, sortable
// ============================================
const list = async (tenantId, query) => {
  const { type, search, isActive, page, pageSize, sort, order } = query;

  // Build the where clause
  const where = { tenantId };

  if (type) {
    where.type = type;
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (search) {
    // Search across partNumber and description
    where.OR = [
      { partNumber: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Run count and find in parallel for efficiency
  const [total, items] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const meta = {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };

  return { items, meta };
};

// ============================================
// GET BY ID — single item (relations added in later phases)
// ============================================
const getById = async (id, tenantId) => {
  const item = await prisma.item.findFirst({
    where: { id, tenantId },
  });

  if (!item) {
    throw notFoundError('Item not found');
  }

  return item;
};

// ============================================
// CREATE — inject tenantId from middleware
// ============================================
const create = async (data, tenantId) => {
  const item = await prisma.item.create({
    data: { ...data, tenantId },
  });

  return item;
};

// ============================================
// UPDATE — only updates within tenant scope
// ============================================
const update = async (id, data, tenantId) => {
  // Verify the item exists and belongs to this tenant
  await getById(id, tenantId);

  const item = await prisma.item.update({
    where: { id },
    data,
  });

  return item;
};

// ============================================
// DEACTIVATE — soft disable, never hard delete
// ============================================
const deactivate = async (id, tenantId) => {
  // Verify the item exists and belongs to this tenant
  await getById(id, tenantId);

  const item = await prisma.item.update({
    where: { id },
    data: { isActive: false },
  });

  return item;
};

module.exports = { list, getById, create, update, deactivate };
