import { createUploadthing, type FileRouter } from "uploadthing/next-legacy";
import { supabase } from "@/utils/supabase";
 
const f = createUploadthing();
 
export const ourFileRouter = {
  bugReportScreenshot: f({ image: { maxFileSize: "4MB", maxFileCount: 5 } })
    .middleware(async ({ req }) => {
      // Get user session if available (optional for bug reports)
      const authHeader = req.headers.authorization;
      let userId: string | null = null;
      
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }
      
      // Return metadata to be stored with the file
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Use ufsUrl (v8+) with fallback to appUrl for compatibility
      const fileUrl = (file as unknown as { ufsUrl?: string; appUrl: string }).ufsUrl || file.appUrl;
      console.log("Bug report screenshot uploaded:", fileUrl);
      console.log("Upload metadata:", metadata);
      
      // Return data to the client
      return { uploadedBy: metadata.userId, url: fileUrl };
    }),
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;