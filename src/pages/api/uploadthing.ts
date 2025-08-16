import { createRouteHandler } from "uploadthing/next-legacy";
import { ourFileRouter } from "@/server/uploadthing";
 
export default createRouteHandler({
  router: ourFileRouter,
  // UploadThing v7 reads UPLOADTHING_TOKEN from environment automatically
});