import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const animation = await prisma.openingAnimation.findUnique({
      where: { id: params.id },
      include: { project: true },
    })

    if (!animation) {
      return NextResponse.json({ error: 'Animation not found' }, { status: 404 })
    }

    return NextResponse.json({ animation })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { config } = await req.json()

    const animation = await prisma.openingAnimation.update({
      where: { id: params.id },
      data: { config: config as any },
    })

    return NextResponse.json({ success: true, animation })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
