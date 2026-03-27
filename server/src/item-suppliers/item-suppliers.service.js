const { prisma } = require('../db');
const { notFoundError } = require('../utils/errors');

/** List all suppliers linked to an item (includes supplier details). */
const list = async (itemId, tenantId) => {
  // Verify the item exists and belongs to this tenant
  const item = await prisma.item.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw notFoundError('Item not found');

  return prisma.itemSupplier.findMany({
    where: { itemId },
    include: { supplier: { select: { id: true, name: true, code: true, isActive: true } } },
    orderBy: [{ isPreferred: 'desc' }, { createdAt: 'asc' }],
  });
};

/** Create a new item-supplier link. */
const create = async (itemId, data, tenantId) => {
  // Verify the item belongs to this tenant
  const item = await prisma.item.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw notFoundError('Item not found');

  // Verify the supplier belongs to this tenant
  const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, tenantId } });
  if (!supplier) throw notFoundError('Supplier not found');

  return prisma.itemSupplier.create({
    data: { ...data, itemId },
    include: { supplier: { select: { id: true, name: true, code: true, isActive: true } } },
  });
};

/** Update an existing item-supplier link. */
const update = async (itemId, supplierId, data, tenantId) => {
  // Verify the item belongs to this tenant
  const item = await prisma.item.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw notFoundError('Item not found');

  const link = await prisma.itemSupplier.findFirst({
    where: { itemId, supplierId },
  });
  if (!link) throw notFoundError('Item-supplier link not found');

  return prisma.itemSupplier.update({
    where: { id: link.id },
    data,
    include: { supplier: { select: { id: true, name: true, code: true, isActive: true } } },
  });
};

/** Delete an item-supplier link (hard delete — it's a join record). */
const remove = async (itemId, supplierId, tenantId) => {
  // Verify the item belongs to this tenant
  const item = await prisma.item.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw notFoundError('Item not found');

  const link = await prisma.itemSupplier.findFirst({
    where: { itemId, supplierId },
  });
  if (!link) throw notFoundError('Item-supplier link not found');

  await prisma.itemSupplier.delete({ where: { id: link.id } });
  return { success: true };
};

module.exports = { list, create, update, remove };
