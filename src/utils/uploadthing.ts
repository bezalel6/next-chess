import { generateUploadButton, generateUploadDropzone, generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/server/uploadthing";

export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();

// Lazy initialization to prevent automatic polling
let uploadThingHelpersCache: ReturnType<typeof generateReactHelpers<OurFileRouter>> | null = null;

const getUploadThingHelpers = () => {
  if (!uploadThingHelpersCache) {
    uploadThingHelpersCache = generateReactHelpers<OurFileRouter>({
      url: "/api/uploadthing"
    });
  }
  return uploadThingHelpersCache;
};

// Export the custom hook for bug report uploads
export const useUploadThing = () => {
  const helpers = getUploadThingHelpers();
  const { startUpload, isUploading } = helpers.useUploadThing("bugReportScreenshot");
  
  return {
    startUpload: async (files: File[]) => {
      try {
        const res = await startUpload(files);
        if (!res || res.length === 0) {
          console.error(
            "UploadThing returned no results. Check /api/uploadthing route and env (UPLOADTHING_TOKEN).",
            res
          );
          throw new Error("UploadThing returned no results");
        }
        return res;
      } catch (error) {
        console.error("Upload error:", error);
        throw error;
      }
    },
    isUploading,
  };
};
