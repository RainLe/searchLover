// OCR 传输层：压缩、上传、解析、取消。同一张图片会复用上次的识别结果。
const config = require('../config/index');
const ocrCache = require('../utils/ocrCache');
const { track } = require('../utils/metrics');

let activeTasks = [];

function makeError(code, message, detail) {
  const error = new Error(message || code);
  error.code = code;
  if (detail !== undefined) error.detail = detail;
  return error;
}

function ensureKey() {
  const key = config.secrets.ocrApiKey || '';
  if (!key || key.indexOf('your') === 0) {
    throw makeError('CONFIG', '未配置 OCR Key，请检查 config/secrets.local.js');
  }
}

function compressImage(path) {
  return new Promise((resolve) => {
    if (typeof wx.compressImage !== 'function') {
      resolve(path);
      return;
    }
    wx.compressImage({
      src: path,
      quality: config.ocr.compressQuality,
      success: (res) => resolve(res.tempFilePath || path),
      fail: () => resolve(path)
    });
  });
}

function readErrorMessage(data) {
  if (!data) return '';
  const message = data.ErrorMessage;
  if (Array.isArray(message)) return message.join('；');
  return typeof message === 'string' ? message : '';
}

// 用文件内容生成指纹：同一张截图即使临时路径变了，也能命中缓存。
function fingerprint(path) {
  return new Promise((resolve) => {
    let fs = null;
    try {
      fs = typeof wx !== 'undefined' && typeof wx.getFileSystemManager === 'function'
        ? wx.getFileSystemManager()
        : null;
    } catch (e) {
      fs = null;
    }

    if (!fs) {
      resolve('');
      return;
    }

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const fallback = () => hashFile(fs, path, done);

    try {
      if (typeof fs.getFileInfo !== 'function') {
        fallback();
        return;
      }
      fs.getFileInfo({
        filePath: path,
        digestAlgorithm: 'md5',
        success: (res) => {
          if (res && res.digest) {
            done(`${res.size || 0}-${res.digest}`);
          } else {
            fallback();
          }
        },
        fail: fallback
      });
    } catch (e) {
      fallback();
    }
  });
}

// getFileInfo 不可用时的兜底：读取文件并计算两个 32 位哈希。
function hashFile(fs, path, done) {
  if (typeof fs.readFile !== 'function') {
    done('');
    return;
  }
  try {
    fs.readFile({
      filePath: path,
      success: (res) => {
        try {
          const bytes = new Uint8Array(res.data);
          let hashA = 2166136261;
          let hashB = 5381;
          for (let i = 0; i < bytes.length; i += 1) {
            hashA ^= bytes[i];
            hashA = Math.imul(hashA, 16777619);
            hashB = (Math.imul(hashB, 33) + bytes[i]) | 0;
          }
          done(`${bytes.length}-${(hashA >>> 0).toString(16)}${(hashB >>> 0).toString(16)}`);
        } catch (e) {
          done('');
        }
      },
      fail: () => done('')
    });
  } catch (e) {
    done('');
  }
}

function cacheKeyFor(id) {
  return id ? `${config.ocr.language}|${id}` : '';
}

function uploadImage(path) {
  return compressImage(path).then((filePath) => new Promise((resolve, reject) => {
    const task = wx.uploadFile({
      url: config.ocr.url,
      filePath,
      name: 'file',
      timeout: config.api.requestTimeout,
      header: {
        apikey: config.secrets.ocrApiKey
      },
      formData: {
        language: config.ocr.language,
        isOverlayRequired: 'false',
        detectOrientation: 'true',
        scale: 'true'
      },
      success(res) {
        activeTasks = activeTasks.filter((item) => item !== task);

        if (res.statusCode && res.statusCode !== 200) {
          reject(makeError('HTTP', `识别服务返回 ${res.statusCode}`, res.data));
          return;
        }

        let data = null;
        try {
          data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        } catch (e) {
          reject(makeError('PARSE', '识别结果解析失败', res.data));
          return;
        }

        if (data && data.IsErroredOnProcessing) {
          reject(makeError('OCR_FAIL', readErrorMessage(data) || '图片识别失败', data));
          return;
        }

        const parsed = data && data.ParsedResults && data.ParsedResults[0];
        const text = parsed && parsed.ParsedText ? parsed.ParsedText.trim() : '';
        if (!text) {
          reject(makeError('NO_TEXT', '这张截图没有识别到文字'));
          return;
        }

        resolve(text);
      },
      fail(err) {
        activeTasks = activeTasks.filter((item) => item !== task);
        const message = (err && err.errMsg) || '';
        if (message.indexOf('abort') !== -1) {
          reject(makeError('ABORTED', '已取消识别'));
          return;
        }
        reject(makeError('NETWORK', '截图上传失败', err));
      }
    });

    activeTasks.push(task);
  }));
}

function recognizeImage(path) {
  return Promise.resolve()
    .then(() => fingerprint(path))
    .catch(() => '')
    .then((id) => {
      const cacheKey = cacheKeyFor(id);
      const cached = cacheKey ? ocrCache.get(cacheKey) : '';
      if (cached) {
        track('ocr_cache_hit');
        return cached;
      }

      ensureKey();
      return uploadImage(path).then((text) => {
        if (cacheKey) ocrCache.set(cacheKey, text);
        return text;
      });
    });
}

function abortAll() {
  activeTasks.forEach((task) => {
    try {
      task.abort();
    } catch (e) {
      // ignore
    }
  });
  activeTasks = [];
}

module.exports = {
  recognizeImage,
  compressImage,
  abortAll
};
