/**
 * Tencent COS adapter for 眠安.
 *
 * Reads creds from ~/.tencent/credentials (NEVER from project env files).
 * Bucket + region from env (set via setup script output):
 *   COS_BUCKET=mianan-audio-1258246081
 *   COS_REGION=ap-hongkong
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import COS from "cos-nodejs-sdk-v5";

const SIGNED_URL_TTL_SEC = 30 * 60; // 30 min

let _client: any | null = null;

function client(): any {
  if (_client) return _client;
  let id = process.env.COS_SECRET_ID;
  let key = process.env.COS_SECRET_KEY;
  if (!id || !key) {
    const credsPath = join(homedir(), ".tencent", "credentials");
    if (existsSync(credsPath)) {
      const raw = readFileSync(credsPath, "utf8");
      id = id ?? raw.match(/secret_id\s*=\s*(\S+)/i)?.[1];
      key = key ?? raw.match(/secret_key\s*=\s*(\S+)/i)?.[1];
    }
  }
  if (!id || !key) {
    throw new Error("COS creds missing: set COS_SECRET_ID + COS_SECRET_KEY or write ~/.tencent/credentials");
  }
  _client = new COS({ SecretId: id, SecretKey: key });
  return _client;
}

function config(): { bucket: string; region: string } {
  const bucket = process.env.COS_BUCKET;
  const region = process.env.COS_REGION;
  if (!bucket || !region) {
    throw new Error("COS_BUCKET and COS_REGION must be set (see scripts/cos-setup.ts output)");
  }
  return { bucket, region };
}

export async function uploadAudio(
  key: string,
  body: Buffer,
  contentType = "audio/mpeg",
): Promise<{ key: string; etag: string }> {
  const { bucket, region } = config();
  const data: any = await new Promise((resolve, reject) =>
    client().putObject(
      { Bucket: bucket, Region: region, Key: key, Body: body, ContentType: contentType },
      (err: any, d: any) => (err ? reject(err) : resolve(d)),
    ),
  );
  return { key, etag: data.ETag };
}

export function signedUrl(key: string, ttlSec = SIGNED_URL_TTL_SEC): string {
  const { bucket, region } = config();
  return client().getObjectUrl({
    Bucket: bucket,
    Region: region,
    Key: key,
    Sign: true,
    Expires: ttlSec,
  });
}
