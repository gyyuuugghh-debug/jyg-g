'use strict';
const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

const isUsername = (v) => typeof v === 'string' && USERNAME_RE.test(v);
const isEmail = (v) => typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v);
const isPassword = (v) => typeof v === 'string' && v.length >= 8 && v.length <= 72 && /[A-Za-z]/.test(v) && /\d/.test(v);

const FILE_LIMITS = {
  submissions: { max: 10 * 1024 * 1024, mime: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  chat: { max: 5 * 1024 * 1024, mime: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'] },
  'assignment-files': { max: 10 * 1024 * 1024, mime: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'] },
};
function checkFile(bucket, file) {
  const l = FILE_LIMITS[bucket];
  if (!l) return 'unknown_bucket';
  if (!file || !l.mime.includes(file.type)) return 'type_not_allowed';
  if (file.size > l.max) return 'file_too_large';
  if (file.size === 0) return 'empty_file';
  return null;
}
module.exports = { isUsername, isEmail, isPassword, checkFile, FILE_LIMITS };
