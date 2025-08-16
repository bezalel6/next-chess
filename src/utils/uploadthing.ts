import { generateUploadButton, generateUploadDropzone, generateUploader } from "@uploadthing/react";
import type { OurFileRouter } from "@/server/uploadthing";

export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();
const uploader = generateUploader<OurFileRouter>({ url: "/api/uploadthing" });

// Custom hook for bug report uploads
export const useUploadThing = () => {
  return {
    startUpload: async (files: File[]) => {
      try {
        // In UploadThing v7, the uploader is a callable function
        const res = await (uploader as any)("bugReportScreenshot", { files });
        if (!res || (Array.isArray(res) && res.length === 0)) {
          console.error(
            "UploadThing returned no results. Check /api/uploadthing route and env (UPLOADTHING_APP_ID/UPLOADTHING_SECRET).",
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
    isUploading: false,
  };
};
