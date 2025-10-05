import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/api/:path*",
    "/(.*)/view/employee/(.*)",   // printed QR URLs
    "/(.*)/employees/(.*)"
  ],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};