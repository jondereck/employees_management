

import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export async function POST (
  req: Request
) {
  try {
    const { userId } = auth();
    const body = await req.json()

    const { name } = body;

    if (!userId) {
      return new NextResponse("Unautorized", { status: 401});
      
    }

    if (!name) {
      return new NextResponse("Name is required", { status: 400})
    }

    const department = await prismadb.department.create({
      data: {
        name,
        userId
      }
    })

    return NextResponse.json(department)
    
  } catch (error) {
    console.log('[DEPARTMENTS_POST]', error);
    return new NextResponse("Internal error", {status: 500})
  }
}