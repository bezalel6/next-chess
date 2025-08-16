import { generateUploadButton, generateUploadDropzone, generateUploader } from "@uploadthing/react";
import type { OurFileRouter } from "@/server/uploadthing";

export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();
export const Uploader = generateUploader<OurFileRouter>();

// Custom hook for bug report uploads
export const useUploadThing = () => {
  const uploader = Uploader();
  
  return {
    startUpload: async (files: File[]) => {
      try {
        const result = await uploader("bugReportScreenshot", {
          files,
        });
        return result;
      } catch (error) {
        console.error("Upload error:", error);
        throw error;
      }
    },
    isUploading: false, // This would need state management for real tracking
  };
};