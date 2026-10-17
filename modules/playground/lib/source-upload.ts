import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { MAX_PACKED_CHARS } from "./source-codec";

export const CHUNK_CHARS = 1024 * 1024;
export const UPLOAD_COLLECTION = "SourceUpload";
const lifetime = 15 * 60 * 1000;
let expiryIndex: Promise<unknown> | undefined;
const revision = z.string().regex(/^[a-f0-9]{64}$/).nullable();
const record = z.object({ uploadId: z.string().uuid(), projectId: z.string(), expectedRevision: revision,
  totalLength: z.number().int().positive().max(MAX_PACKED_CHARS), nextChunk: z.number().int().nonnegative(),
  totalChunks: z.number().int().positive(), chunks: z.array(z.string()) });
async function command(value: Parameters<typeof db.$runCommandRaw>[0]) {
  const result = await db.$runCommandRaw({ ...value, ...(("findAndModify" in value || "createIndexes" in value) ? { maxTimeMS: 10000 } : {}) });
  if (Array.isArray(result.writeErrors) && result.writeErrors.length) throw new ApiError(409, "An upload is already active. Retry after it finishes or expires.");
  if (result.ok !== 1) throw new ApiError(503, "Temporary source storage is unavailable");
  return result;
}
export async function beginUpload(userId: string, projectId: string, expectedRevision: string | null, totalLength: number) {
  // Provision only the new temporary collection's expiry index; never alter project indexes.
  expiryIndex ??= command({ createIndexes: UPLOAD_COLLECTION, indexes: [{ key: { expiresAt: 1 }, name: "source_upload_expiry", expireAfterSeconds: 0 }] }).catch(error => { expiryIndex = undefined; throw error; });
  await expiryIndex;
  const now = Date.now();
  // One fixed document per account bounds concurrent temporary storage, across instances.
  await command({ delete: UPLOAD_COLLECTION, deletes: [{ q: { _id: userId, expiresAt: { $lte: { $date: new Date(now).toISOString() } } }, limit: 1 }] });
  const uploadId = randomUUID();
  const totalChunks = Math.ceil(totalLength / CHUNK_CHARS);
  await command({ insert: UPLOAD_COLLECTION, documents: [{ _id: userId, projectId, uploadId, expectedRevision, totalLength, totalChunks, nextChunk: 0, chunks: [], expiresAt: { $date: new Date(now + lifetime).toISOString() } }] });
  return { uploadId, totalChunks };
}
export async function appendUpload(userId: string, projectId: string, uploadId: string, index: number, chunk: string) {
  const result = await command({ findAndModify: UPLOAD_COLLECTION,
    query: { _id: userId, projectId, uploadId, nextChunk: index, totalChunks: { $gt: index }, expiresAt: { $gt: { $date: new Date().toISOString() } } },
    update: { $push: { chunks: chunk }, $inc: { nextChunk: 1 } }, fields: { totalLength: 1, totalChunks: 1 }, new: true });
  if (!result.value) throw new ApiError(409, "Upload expired or chunks arrived out of order. Retry saving.");
}
export async function takeUpload(userId: string, projectId: string, uploadId: string) {
  const result = await command({ findAndModify: UPLOAD_COLLECTION,
    query: { _id: userId, projectId, uploadId, $expr: { $eq: ["$nextChunk", "$totalChunks"] }, expiresAt: { $gt: { $date: new Date().toISOString() } } }, remove: true });
  const parsed = record.safeParse(result.value);
  if (!parsed.success) throw new ApiError(409, "Upload is incomplete or expired. Retry saving.");
  const { chunks, totalLength, expectedRevision } = parsed.data;
  const content = chunks.join("");
  if (content.length !== totalLength) throw new ApiError(400, "Upload length mismatch. Your saved project was not changed.");
  return { content, expectedRevision };
}
export async function abortUpload(userId: string, projectId: string, uploadId: string) {
  await command({ delete: UPLOAD_COLLECTION, deletes: [{ q: { _id: userId, projectId, uploadId }, limit: 1 }] });
}
