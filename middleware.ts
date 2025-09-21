import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    "/api/:path*",
    "/(.*)/view/employee/(.*)",   // printed QR URLs
    // add "/(.*)/employees/(.*)" too if you use that path publicly
  ],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
