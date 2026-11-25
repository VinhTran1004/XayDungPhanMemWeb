const crypto = require('crypto');
const path = require('path');
const supabase = require('../config/supabase');
const { AppError } = require('../utils/response');

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'studio-albums';

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

/**
 * Upload a file buffer to the private Supabase Storage bucket and return its storage path.
 */
const uploadBufferToStorage = async ({ buffer, originalName, mimeType, folder }) => {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const storagePath = `${folder}/${uniqueName}`;

  const { error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, buffer, {
    contentType: mimeType || 'image/jpeg',
    upsert: false,
  });

  if (error) {
    throw new AppError(`Lỗi upload ảnh lên Supabase Storage: ${error.message}`, 500, 'STORAGE_UPLOAD_FAILED');
  }

  return storagePath;
};

/**
 * Resolve an array of storage paths or external HTTP URLs into viewable/downloadable URLs.
 */
const resolveStorageUrls = async (pathsOrUrls, { expiresIn = 3600, download = false } = {}) => {
  const result = new Array(pathsOrUrls.length).fill(null);
  const storageIndices = [];
  const storagePaths = [];

  pathsOrUrls.forEach((item, idx) => {
    if (!item) {
      result[idx] = null;
    } else if (isHttpUrl(item)) {
      result[idx] = item;
    } else {
      storageIndices.push(idx);
      storagePaths.push(item);
    }
  });

  if (storagePaths.length > 0) {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(storagePaths, expiresIn, { download });

    if (error) {
      throw new AppError(`Lỗi tạo link xem ảnh bảo mật: ${error.message}`, 500, 'SIGNED_URL_FAILED');
    }

    (data || []).forEach((entry, i) => {
      const targetIdx = storageIndices[i];
      result[targetIdx] = entry.signedUrl || null;
    });
  }

  return result;
};

/**
 * Delete files from Supabase Storage (ignoring external HTTP URLs).
 */
const deleteFromStorage = async (pathsOrUrls) => {
  const storagePaths = (pathsOrUrls || []).filter((p) => p && !isHttpUrl(p));
  if (storagePaths.length === 0) return;
  await supabase.storage.from(BUCKET_NAME).remove(storagePaths);
};

module.exports = {
  BUCKET_NAME,
  isHttpUrl,
  uploadBufferToStorage,
  resolveStorageUrls,
  deleteFromStorage,
};
