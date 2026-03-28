// Shared CSV import utility.
// Parses a CSV buffer, validates each row against a Zod schema,
// and returns { valid, errors } for the caller to insert.

const { parse } = require('csv-parse/sync');

/**
 * Parse and validate a CSV buffer against a Zod schema.
 * @param {Buffer} buffer — raw file contents from multer
 * @param {z.ZodSchema} schema — Zod schema for a single row
 * @returns {{ valid: object[], errors: { row: number, message: string }[] }}
 */
const parseAndValidate = (buffer, schema) => {
  // Parse CSV with auto-detected columns from the header row
  const records = parse(buffer, {
    columns: true,       // first row = column headers
    skip_empty_lines: true,
    trim: true,
  });

  const valid = [];
  const errors = [];

  records.forEach((record, idx) => {
    const rowNum = idx + 2; // +2 because row 1 is the header, idx is 0-based

    // Convert empty strings to undefined so Zod optional fields work correctly
    const cleaned = {};
    for (const [key, value] of Object.entries(record)) {
      cleaned[key] = value === '' ? undefined : value;
    }

    const result = schema.safeParse(cleaned);
    if (result.success) {
      valid.push(result.data);
    } else {
      const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      errors.push({ row: rowNum, message: messages.join('; ') });
    }
  });

  return { valid, errors };
};

module.exports = { parseAndValidate };
