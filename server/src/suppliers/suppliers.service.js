const { prisma } = require('../db');
const { notFoundError } = require('../utils/errors');

/** List suppliers — paginated, searchable, sortable. */
const list = async (tenantId, query) => {
  const { search, isActive, page, pageSize, sort, order } = query;

  const where = { tenantId };

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { contactName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, suppliers] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
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

  return { suppliers, meta };
};

/** Get a single supplier by ID within tenant scope. */
const getById = async (id, tenantId) => {
  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId },
  });

  if (!supplier) {
    throw notFoundError('Supplier not found');
  }

  return supplier;
};

/** Create a new supplier. */
const create = async (data, tenantId) => {
  return prisma.supplier.create({
    data: { ...data, tenantId },
  });
};

/** Update an existing supplier within tenant scope. */
const update = async (id, data, tenantId) => {
  await getById(id, tenantId);

  return prisma.supplier.update({
    where: { id },
    data,
  });
};

/** Soft-deactivate a supplier. */
const deactivate = async (id, tenantId) => {
  await getById(id, tenantId);

  return prisma.supplier.update({
    where: { id },
    data: { isActive: false },
  });
};

module.exports = { list, getById, create, update, deactivate };
