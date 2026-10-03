const queues = new Map();

/** Runs tasks for the same device one at a time, so concurrent requests can't corrupt its state. */
export function serialize(deviceId, task) {
  const previous = queues.get(deviceId) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(
    deviceId,
    next.catch(() => {})
  );
  return next;
}
