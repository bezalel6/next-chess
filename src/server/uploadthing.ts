import { createUploadthing, type FileRouter } from "uploadthing/next-legacy";
import { supabase } from "@/utils/supabase";
 
const f = createUploadthing();
 
export const ourFileRouter = {
  bugReportScreenshot: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
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
      console.log("Bug report screenshot uploaded:", file.url);
      console.log("Upload metadata:", metadata);
      
      // Return data to the client
      return { uploadedBy: metadata.userId, url: file.url };
    }),
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;