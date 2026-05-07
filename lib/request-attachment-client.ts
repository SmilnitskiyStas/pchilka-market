export type UploadedRequestAttachment = {
  fileName: string;
  fileSize: number;
  fileType: string;
  lastModified: number;
  url: string;
};

type UploadResponse = {
  ok?: boolean;
  error?: string;
  attachment?: UploadedRequestAttachment;
};

type UploadRequestAttachmentOptions = {
  folder?: string;
};

export async function uploadRequestAttachment(
  file: File,
  options: UploadRequestAttachmentOptions = {}
): Promise<UploadedRequestAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  if (options.folder) {
    formData.append('folder', options.folder);
  }

  const response = await fetch('/api/uploads/request-attachment', {
    method: 'POST',
    body: formData
  });

  const payload = (await response.json()) as UploadResponse;
  if (!response.ok || !payload.ok || !payload.attachment) {
    throw new Error(payload.error || 'Не вдалося завантажити файл.');
  }

  return payload.attachment;
}
