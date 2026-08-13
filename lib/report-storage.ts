export async function storePdfReport(bucket: R2Bucket, objectKey: string, pdf: Uint8Array) {
  await bucket.put(objectKey, pdf, {
    httpMetadata: { contentType: "application/pdf" },
  });
}
