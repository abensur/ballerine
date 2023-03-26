import { z } from 'zod';
import { handleZodError } from '../utils/handle-zod-error/handle-zod-error';
import { apiClient } from './api-client';
import { endpoints } from './endpoints';

export const storage = {
  fileById: async (fileId: string) => {
    const [blob, error] = await apiClient({
      endpoint: endpoints.storage.fileById.endpoint(fileId),
      method: endpoints.storage.fileById.method,
      schema: z.instanceof(Blob),
      isBlob: true,
    });

    return handleZodError(error, blob);
  },
};
