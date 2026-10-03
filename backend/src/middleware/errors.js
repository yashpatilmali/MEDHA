/** An error whose message is safe to send to the client. `fields` maps form fields to messages. */
export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/** Parses `data` with a Zod schema, or throws a 400 listing the first problem with each field. */
export function validate(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;

  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'body';
    fields[key] ??= issue.message;
  }
  throw new HttpError(400, Object.values(fields)[0], fields);
}

export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
}

// Express recognises error handlers by their four parameters, so `next` must stay.
export function errorHandler(error, req, res, next) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, fields: error.fields });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'The request body must be valid JSON.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
}
