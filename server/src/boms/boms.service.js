const { prisma } = require('../db');
const { notFoundError, AppError } = require('../utils/errors');

// Include lines with item details when fetching a BOM
const LINES_INCLUDE = {
  bomLines: {
    include: { item: { select: { id: true, partNumber: true, description: true, type: true, unitOfMeasure: true } } },
    orderBy: { position: 'asc' },
  },
};

// Valid status transitions: from → [allowed targets]
const VALID_TRANSITIONS = {
  draft: ['active', 'obsolete'],
  active: ['obsolete'],
  obsolete: [],
};

/** List BOMs — paginated, filterable by itemId and status. */
const list = async (tenantId, query) => {
  const { itemId, status, page, pageSize, sort, order } = query;

  const where = { tenantId };
  if (itemId) where.itemId = itemId;
  if (status) where.status = status;

  const [total, boms] = await Promise.all([
    prisma.bom.count({ where }),
    prisma.bom.findMany({
      where,
      include: {
        item: { select: { id: true, partNumber: true, description: true } },
        _count: { select: { bomLines: true } },
      },
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    boms,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  };
};

/** Get a single BOM by ID with all lines. */
const getById = async (id, tenantId) => {
  const bom = await prisma.bom.findFirst({
    where: { id, tenantId },
    include: {
      item: { select: { id: true, partNumber: true, description: true, type: true } },
      ...LINES_INCLUDE,
    },
  });

  if (!bom) throw notFoundError('BOM not found');
  return bom;
};

/** Explode a BOM into a multi-level tree (recursive). */
const getTree = async (id, tenantId) => {
  const bom = await getById(id, tenantId);

  // Recursive function to build tree — tracks visited IDs to detect circular refs
  const explode = async (bomLines, visited = new Set()) => {
    const tree = [];

    for (const line of bomLines) {
      if (visited.has(line.itemId)) {
        tree.push({
          ...line,
          _circular: true,
          children: [],
        });
        continue;
      }

      // Check if this component item has its own active BOM
      const childBom = await prisma.bom.findFirst({
        where: { itemId: line.itemId, tenantId, status: 'active' },
        include: LINES_INCLUDE,
      });

      const node = { ...line, children: [] };

      if (childBom) {
        const nextVisited = new Set(visited);
        nextVisited.add(line.itemId);
        node.children = await explode(childBom.bomLines, nextVisited);
      }

      tree.push(node);
    }

    return tree;
  };

  const tree = await explode(bom.bomLines, new Set([bom.itemId]));
  return { ...bom, tree };
};

/** Create a new BOM with lines (transactional). */
const create = async (data, tenantId) => {
  const { lines, ...header } = data;

  // Verify the parent item exists and belongs to this tenant
  const item = await prisma.item.findFirst({ where: { id: header.itemId, tenantId } });
  if (!item) throw notFoundError('Item not found');

  // Create BOM + lines in a transaction
  const bom = await prisma.$transaction(async (tx) => {
    const created = await tx.bom.create({
      data: {
        ...header,
        tenantId,
        bomLines: {
          create: lines.map((line, idx) => ({
            ...line,
            position: line.position ?? idx + 1,
          })),
        },
      },
      include: {
        item: { select: { id: true, partNumber: true, description: true, type: true } },
        ...LINES_INCLUDE,
      },
    });

    return created;
  });

  return bom;
};

/** Update a BOM header and optionally replace all lines. */
const update = async (id, data, tenantId) => {
  const existing = await getById(id, tenantId);

  // Can only edit draft BOMs
  if (existing.status !== 'draft') {
    throw new AppError(400, 'INVALID_TRANSITION', 'Only draft BOMs can be edited');
  }

  const { lines, ...header } = data;

  const bom = await prisma.$transaction(async (tx) => {
    // Update header fields
    if (Object.keys(header).length > 0) {
      await tx.bom.update({ where: { id }, data: header });
    }

    // If lines provided, replace all existing lines
    if (lines) {
      await tx.bomLine.deleteMany({ where: { bomId: id } });
      await tx.bomLine.createMany({
        data: lines.map((line, idx) => ({
          ...line,
          bomId: id,
          position: line.position ?? idx + 1,
        })),
      });
    }

    // Re-fetch with includes
    return tx.bom.findFirst({
      where: { id },
      include: {
        item: { select: { id: true, partNumber: true, description: true, type: true } },
        ...LINES_INCLUDE,
      },
    });
  });

  return bom;
};

/** Change BOM status with transition validation. */
const changeStatus = async (id, newStatus, tenantId) => {
  const existing = await getById(id, tenantId);

  const allowed = VALID_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      400,
      'INVALID_TRANSITION',
      `Cannot transition from '${existing.status}' to '${newStatus}'`
    );
  }

  // If activating, ensure no other active BOM for this item
  if (newStatus === 'active') {
    const activeExists = await prisma.bom.findFirst({
      where: { itemId: existing.itemId, tenantId, status: 'active', id: { not: id } },
    });

    if (activeExists) {
      throw new AppError(
        409,
        'DUPLICATE_ENTRY',
        'An active BOM already exists for this item. Obsolete it first or use revise.'
      );
    }
  }

  return prisma.bom.update({
    where: { id },
    data: { status: newStatus },
    include: {
      item: { select: { id: true, partNumber: true, description: true, type: true } },
      ...LINES_INCLUDE,
    },
  });
};

/** Revise a BOM — creates a new draft copy, marks the original as obsolete. */
const revise = async (id, tenantId) => {
  const existing = await getById(id, tenantId);

  if (existing.status !== 'active') {
    throw new AppError(400, 'INVALID_TRANSITION', 'Only active BOMs can be revised');
  }

  // Generate next revision label (e.g., "A" → "B", "Rev-1" → "Rev-1 (revised)")
  const nextRevision = `${existing.revision}-R`;

  const newBom = await prisma.$transaction(async (tx) => {
    // Mark original as obsolete
    await tx.bom.update({ where: { id }, data: { status: 'obsolete' } });

    // Create new draft with copied lines
    return tx.bom.create({
      data: {
        tenantId,
        itemId: existing.itemId,
        revision: nextRevision,
        status: 'draft',
        notes: existing.notes,
        bomLines: {
          create: existing.bomLines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            unitOfMeasure: line.unitOfMeasure,
            position: line.position,
            scrapFactor: line.scrapFactor,
            notes: line.notes,
          })),
        },
      },
      include: {
        item: { select: { id: true, partNumber: true, description: true, type: true } },
        ...LINES_INCLUDE,
      },
    });
  });

  return newBom;
};

module.exports = { list, getById, getTree, create, update, changeStatus, revise };
