export type DiffOperation = 'equal' | 'insert' | 'delete';

export interface DiffEntry {
  operation: DiffOperation;
  text: string;
}

/** Appends an entry, merging with the previous one when the operation matches. */
export function pushEntry(entries: DiffEntry[], operation: DiffOperation, text: string): void {
  const last = entries[entries.length - 1];
  if (last !== undefined && last.operation === operation) last.text += text;
  else entries.push({ operation, text });
}
