import { isIos, isStandalone } from '../services/installService';

/** Saves text as a file. Returns 'downloaded' | 'shared' | 'cancelled'. */
export async function saveTextFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const file = new File([blob], filename, { type: mime });

  // An installed iPhone app can't reliably download via a link, so use the share sheet there.
  if (isIos() && isStandalone() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}